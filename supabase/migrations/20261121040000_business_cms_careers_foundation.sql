-- ============================================================================
-- STROVYN BUSINESS CMS — PHASE D: CAREERS & VACANCIES MANAGEMENT
-- Migration 013 (Additive, idempotent, staging-safe)
-- ============================================================================

-- 1. Extend public.job_openings with governance, publication, deadline, and ordering columns
ALTER TABLE public.job_openings
  ALTER COLUMN location SET DEFAULT 'Adelaide, South Australia';

ALTER TABLE public.job_openings
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT NOT NULL DEFAULT 'Architectural Finishing',
  ADD COLUMN IF NOT EXISTS application_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS publication_status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS is_open BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS published_by UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- Backfill slug for any pre-existing rows before enforcing NOT NULL + UNIQUE
UPDATE public.job_openings
SET slug = LOWER(REGEXP_REPLACE(TRIM(title), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || SUBSTRING(id::text, 1, 8)
WHERE slug IS NULL OR BTRIM(slug) = '';

ALTER TABLE public.job_openings
  ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS job_openings_slug_uidx
  ON public.job_openings (slug);

ALTER TABLE public.job_openings
  DROP CONSTRAINT IF EXISTS job_openings_publication_status_check;

ALTER TABLE public.job_openings
  ADD CONSTRAINT job_openings_publication_status_check
  CHECK (publication_status IN ('draft', 'published', 'archived'));

ALTER TABLE public.job_openings
  DROP CONSTRAINT IF EXISTS job_openings_published_requires_timestamp_check;

ALTER TABLE public.job_openings
  ADD CONSTRAINT job_openings_published_requires_timestamp_check
  CHECK (
    publication_status <> 'published'
    OR published_at IS NOT NULL
  );

CREATE INDEX IF NOT EXISTS job_openings_public_active_idx
  ON public.job_openings (publication_status, is_open, sort_order ASC, published_at DESC)
  WHERE publication_status = 'published' AND is_open = TRUE;

-- 2. Touch updated_at automatically on update
CREATE OR REPLACE FUNCTION public.job_openings_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_openings_touch_updated_at ON public.job_openings;
CREATE TRIGGER trg_job_openings_touch_updated_at
  BEFORE UPDATE ON public.job_openings
  FOR EACH ROW
  EXECUTE FUNCTION public.job_openings_touch_updated_at();

-- 3. Update Public RLS policy & grants on public.job_openings
-- Public anonymous access is strictly limited to published, open, and non-expired vacancies.
DROP POLICY IF EXISTS "Public job openings read" ON public.job_openings;
CREATE POLICY "Public job openings read"
  ON public.job_openings
  FOR SELECT
  USING (
    publication_status = 'published'
    AND is_open = TRUE
    AND (application_deadline IS NULL OR application_deadline > NOW())
  );

REVOKE ALL ON TABLE public.job_openings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.job_openings TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.job_openings TO service_role;

-- 4. Extend atomic application submission RPC to accept optional p_job_opening_id
-- and enforce server/DB-level vacancy open/published/deadline eligibility when provided.
DROP FUNCTION IF EXISTS public.cms_submit_application_with_attachment(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
);

CREATE OR REPLACE FUNCTION public.cms_submit_application_with_attachment(
  p_application_id UUID,
  p_applicant_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_cover_letter TEXT,
  p_status TEXT DEFAULT 'pending',
  p_cv_url TEXT DEFAULT NULL,
  p_claim_token_hash TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_job_opening_id UUID DEFAULT NULL
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
  v_opening public.job_openings%ROWTYPE;
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

  IF p_job_opening_id IS NOT NULL THEN
    SELECT *
    INTO v_opening
    FROM public.job_openings
    WHERE id = p_job_opening_id
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'VACANCY_NOT_FOUND: Selected vacancy does not exist';
    END IF;

    IF v_opening.publication_status <> 'published' OR v_opening.is_open IS NOT TRUE THEN
      RAISE EXCEPTION 'VACANCY_CLOSED: Selected vacancy is closed and no longer accepting applications';
    END IF;

    IF v_opening.application_deadline IS NOT NULL AND v_opening.application_deadline <= NOW() THEN
      RAISE EXCEPTION 'VACANCY_DEADLINE_PASSED: Application deadline for this vacancy has passed';
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
    job_opening_id,
    applicant_name,
    email,
    phone,
    cover_letter,
    cv_url,
    status,
    idempotency_key
  ) VALUES (
    COALESCE(p_application_id, gen_random_uuid()),
    p_job_opening_id,
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

REVOKE ALL ON FUNCTION public.cms_submit_application_with_attachment(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.cms_submit_application_with_attachment(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID
) TO service_role;
