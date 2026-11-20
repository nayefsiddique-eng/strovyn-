-- ============================================================================
-- STROVYN — MIGRATION 010 (TRANSACTIONAL SUBMISSION HARDENING & UPLOAD CLEANUP)
-- Additive migration preserving 001–009 untouched.
--
-- Features:
--   1. Adds expiration (`expires_at`) and safe cleanup lifecycle columns
--      (`cleanup_state`, `cleanup_error`, `cleaned_at`) plus invariant check
--      to `public.customer_document_uploads` so claimed attachments can never
--      be cleaned up.
--   2. Adds single-transaction `SECURITY DEFINER` RPCs:
--        - `public.cms_submit_quote_with_attachment(...)`
--        - `public.cms_submit_application_with_attachment(...)`
--      Both serialize idempotency keys cleanly via `pg_advisory_xact_lock`,
--      validate attachment category/hash/unclaimed/unexpired state under
--      `FOR UPDATE`, bind the upload, and insert the submission in one atomic
--      PostgreSQL transaction.
--   3. Adds safe orphan reservation RPC
--      `public.cms_reserve_expired_customer_uploads(...)` using
--      `FOR UPDATE SKIP LOCKED` + `NOT EXISTS` cross-checks against both
--      submission tables before marking `cleanup_state = 'pending_cleanup'`.
--   4. Strictly revokes PUBLIC/anon/authenticated EXECUTE privileges; grants
--      EXECUTE solely to `service_role`.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Expiration & Safe Cleanup Lifecycle on `public.customer_document_uploads`
-- ----------------------------------------------------------------------------
ALTER TABLE public.customer_document_uploads
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '2 hours'),
  ADD COLUMN IF NOT EXISTS cleanup_state TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS cleanup_error TEXT,
  ADD COLUMN IF NOT EXISTS cleaned_at TIMESTAMPTZ;

ALTER TABLE public.customer_document_uploads
  DROP CONSTRAINT IF EXISTS customer_document_uploads_cleanup_state_check,
  DROP CONSTRAINT IF EXISTS customer_document_uploads_claim_vs_cleanup_check;

ALTER TABLE public.customer_document_uploads
  ADD CONSTRAINT customer_document_uploads_cleanup_state_check
    CHECK (cleanup_state IN ('active', 'pending_cleanup', 'deleted', 'cleanup_failed')),
  ADD CONSTRAINT customer_document_uploads_claim_vs_cleanup_check
    CHECK (claimed_at IS NULL OR cleanup_state = 'active');

CREATE INDEX IF NOT EXISTS customer_document_uploads_expired_unclaimed_idx
  ON public.customer_document_uploads (expires_at ASC)
  WHERE claimed_at IS NULL AND cleanup_state IN ('active', 'cleanup_failed');

-- ----------------------------------------------------------------------------
-- 2. Atomic Quote Submission & Attachment Claim RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cms_submit_quote_with_attachment(
  p_quote_id UUID,
  p_full_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_project_location TEXT,
  p_service_required TEXT,
  p_description TEXT,
  p_preferred_contact TEXT,
  p_status TEXT DEFAULT 'pending',
  p_attachment_url TEXT DEFAULT NULL,
  p_claim_token_hash TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS TABLE (
  record_id UUID,
  created_at TIMESTAMPTZ,
  deduplicated BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_idem TEXT := NULLIF(TRIM(p_idempotency_key), '');
  v_att TEXT := NULLIF(TRIM(p_attachment_url), '');
  v_token_hash TEXT := LOWER(NULLIF(TRIM(p_claim_token_hash), ''));
  v_existing RECORD;
  v_upload public.customer_document_uploads%ROWTYPE;
  v_inserted_id UUID;
  v_inserted_at TIMESTAMPTZ;
BEGIN
  IF v_idem IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('quote_idem:' || v_idem));

    SELECT q.id, q.created_at, q.attachment_url
    INTO v_existing
    FROM public.quote_requests q
    WHERE q.idempotency_key = v_idem
    LIMIT 1;

    IF FOUND THEN
      IF v_existing.attachment_url IS DISTINCT FROM v_att THEN
        RAISE EXCEPTION 'ATTACHMENT_IDEMPOTENCY_MISMATCH: Idempotency key already used with a different attachment';
      END IF;
      RETURN QUERY SELECT v_existing.id, v_existing.created_at, TRUE;
      RETURN;
    END IF;
  END IF;

  IF v_att IS NOT NULL THEN
    IF v_att NOT LIKE 'supabase://customer-documents/documents/%' OR v_att LIKE '%..%' THEN
      RAISE EXCEPTION 'ATTACHMENT_WRONG_CATEGORY: Invalid quote attachment reference category';
    END IF;

    IF v_token_hash IS NULL OR LENGTH(v_token_hash) <> 64 THEN
      RAISE EXCEPTION 'ATTACHMENT_TOKEN_INVALID: Missing or invalid attachment verification token';
    END IF;

    SELECT *
    INTO v_upload
    FROM public.customer_document_uploads
    WHERE file_reference = v_att
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'ATTACHMENT_NOT_FOUND: Attachment upload record not found';
    END IF;

    IF v_upload.category <> 'documents' THEN
      RAISE EXCEPTION 'ATTACHMENT_WRONG_CATEGORY: Attachment category mismatch';
    END IF;

    IF v_upload.claim_token_hash <> v_token_hash THEN
      RAISE EXCEPTION 'ATTACHMENT_UNAUTHORIZED: Attachment verification token mismatch';
    END IF;

    IF v_upload.claimed_at IS NOT NULL THEN
      RAISE EXCEPTION 'ATTACHMENT_ALREADY_CLAIMED: Attachment has already been claimed by another submission';
    END IF;

    IF v_upload.cleanup_state <> 'active' THEN
      RAISE EXCEPTION 'ATTACHMENT_CLEANED_UP: Attachment is no longer active; please upload your file again';
    END IF;

    IF v_upload.expires_at IS NOT NULL AND v_upload.expires_at <= NOW() THEN
      RAISE EXCEPTION 'ATTACHMENT_EXPIRED: Attachment upload has expired; please upload your file again';
    END IF;

    UPDATE public.customer_document_uploads
    SET
      claimed_by_table = 'quote_requests',
      claimed_record_id = p_quote_id,
      claimed_at = NOW()
    WHERE id = v_upload.id
      AND claimed_at IS NULL
      AND cleanup_state = 'active';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'ATTACHMENT_ALREADY_CLAIMED: Concurrent claim detected';
    END IF;
  END IF;

  INSERT INTO public.quote_requests (
    id,
    full_name,
    email,
    phone,
    project_location,
    service_required,
    description,
    preferred_contact,
    attachment_url,
    status,
    idempotency_key
  ) VALUES (
    COALESCE(p_quote_id, gen_random_uuid()),
    p_full_name,
    p_email,
    p_phone,
    p_project_location,
    p_service_required,
    p_description,
    COALESCE(NULLIF(TRIM(p_preferred_contact), ''), 'email'),
    v_att,
    COALESCE(NULLIF(TRIM(p_status), ''), 'pending'),
    v_idem
  )
  RETURNING id, quote_requests.created_at INTO v_inserted_id, v_inserted_at;

  RETURN QUERY SELECT v_inserted_id, v_inserted_at, FALSE;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Atomic Application Submission & CV Claim RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cms_submit_application_with_attachment(
  p_application_id UUID,
  p_applicant_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_cover_letter TEXT,
  p_status TEXT DEFAULT 'pending',
  p_cv_url TEXT DEFAULT NULL,
  p_claim_token_hash TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS TABLE (
  record_id UUID,
  created_at TIMESTAMPTZ,
  deduplicated BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_idem TEXT := NULLIF(TRIM(p_idempotency_key), '');
  v_cv TEXT := NULLIF(TRIM(p_cv_url), '');
  v_token_hash TEXT := LOWER(NULLIF(TRIM(p_claim_token_hash), ''));
  v_existing RECORD;
  v_upload public.customer_document_uploads%ROWTYPE;
  v_inserted_id UUID;
  v_inserted_at TIMESTAMPTZ;
BEGIN
  IF v_idem IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('app_idem:' || v_idem));

    SELECT a.id, a.created_at, a.cv_url
    INTO v_existing
    FROM public.job_applications a
    WHERE a.idempotency_key = v_idem
    LIMIT 1;

    IF FOUND THEN
      IF v_existing.cv_url IS DISTINCT FROM v_cv THEN
        RAISE EXCEPTION 'ATTACHMENT_IDEMPOTENCY_MISMATCH: Idempotency key already used with a different CV';
      END IF;
      RETURN QUERY SELECT v_existing.id, v_existing.created_at, TRUE;
      RETURN;
    END IF;
  END IF;

  IF v_cv IS NOT NULL THEN
    IF v_cv NOT LIKE 'supabase://customer-documents/resumes/%' OR v_cv LIKE '%..%' THEN
      RAISE EXCEPTION 'ATTACHMENT_WRONG_CATEGORY: Invalid resume reference category';
    END IF;

    IF v_token_hash IS NULL OR LENGTH(v_token_hash) <> 64 THEN
      RAISE EXCEPTION 'ATTACHMENT_TOKEN_INVALID: Missing or invalid resume verification token';
    END IF;

    SELECT *
    INTO v_upload
    FROM public.customer_document_uploads
    WHERE file_reference = v_cv
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'ATTACHMENT_NOT_FOUND: Resume upload record not found';
    END IF;

    IF v_upload.category <> 'resumes' THEN
      RAISE EXCEPTION 'ATTACHMENT_WRONG_CATEGORY: Resume category mismatch';
    END IF;

    IF v_upload.claim_token_hash <> v_token_hash THEN
      RAISE EXCEPTION 'ATTACHMENT_UNAUTHORIZED: Resume verification token mismatch';
    END IF;

    IF v_upload.claimed_at IS NOT NULL THEN
      RAISE EXCEPTION 'ATTACHMENT_ALREADY_CLAIMED: Resume has already been claimed by another submission';
    END IF;

    IF v_upload.cleanup_state <> 'active' THEN
      RAISE EXCEPTION 'ATTACHMENT_CLEANED_UP: Resume is no longer active; please upload your file again';
    END IF;

    IF v_upload.expires_at IS NOT NULL AND v_upload.expires_at <= NOW() THEN
      RAISE EXCEPTION 'ATTACHMENT_EXPIRED: Resume upload has expired; please upload your file again';
    END IF;

    UPDATE public.customer_document_uploads
    SET
      claimed_by_table = 'job_applications',
      claimed_record_id = p_application_id,
      claimed_at = NOW()
    WHERE id = v_upload.id
      AND claimed_at IS NULL
      AND cleanup_state = 'active';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'ATTACHMENT_ALREADY_CLAIMED: Concurrent claim detected';
    END IF;
  END IF;

  INSERT INTO public.job_applications (
    id,
    applicant_name,
    email,
    phone,
    cover_letter,
    cv_url,
    status,
    idempotency_key
  ) VALUES (
    COALESCE(p_application_id, gen_random_uuid()),
    p_applicant_name,
    p_email,
    p_phone,
    p_cover_letter,
    v_cv,
    COALESCE(NULLIF(TRIM(p_status), ''), 'pending'),
    v_idem
  )
  RETURNING id, job_applications.created_at INTO v_inserted_id, v_inserted_at;

  RETURN QUERY SELECT v_inserted_id, v_inserted_at, FALSE;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Safe Expired Unclaimed Upload Reservation RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cms_reserve_expired_customer_uploads(
  p_limit INT DEFAULT 50,
  p_grace_seconds INT DEFAULT 900
)
RETURNS TABLE (
  id UUID,
  bucket_id TEXT,
  storage_path TEXT,
  file_reference TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT u.id
    FROM public.customer_document_uploads u
    WHERE u.claimed_at IS NULL
      AND u.claimed_by_table IS NULL
      AND u.claimed_record_id IS NULL
      AND u.cleanup_state IN ('active', 'cleanup_failed')
      AND u.expires_at <= NOW() - make_interval(secs => GREATEST(0, COALESCE(p_grace_seconds, 0)))
      AND NOT EXISTS (
        SELECT 1
        FROM public.quote_requests q
        WHERE q.attachment_url = u.file_reference
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.job_applications a
        WHERE a.cv_url = u.file_reference
      )
    ORDER BY u.expires_at ASC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200)
    FOR UPDATE OF u SKIP LOCKED
  )
  UPDATE public.customer_document_uploads target
  SET
    cleanup_state = 'pending_cleanup',
    cleanup_error = NULL
  FROM candidates c
  WHERE target.id = c.id
    AND target.claimed_at IS NULL
  RETURNING target.id, target.bucket_id, target.storage_path, target.file_reference;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Strict Privilege Revocations & `service_role` Grants
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.cms_submit_quote_with_attachment(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cms_submit_application_with_attachment(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cms_reserve_expired_customer_uploads(INT, INT) FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.cms_submit_quote_with_attachment(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
    GRANT EXECUTE ON FUNCTION public.cms_submit_application_with_attachment(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
    GRANT EXECUTE ON FUNCTION public.cms_reserve_expired_customer_uploads(INT, INT) TO service_role;
  END IF;
END;
$$;
