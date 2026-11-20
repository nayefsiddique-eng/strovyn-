-- ============================================================================
-- STROVYN — MIGRATION 009 (CUSTOMER DOCUMENTS, PROJECT PHOTOS & UPLOAD BINDING)
-- Additive migration preserving 001–008 and existing RLS policies intact.
--
-- Features:
--   1. Provisions private `customer-documents` Storage bucket (15 MiB,
--      PDF/DOC/DOCX/JPEG/PNG/WebP, zero public or anon/authenticated policies).
--   2. Provisions `project-photos` Storage bucket (public read for portfolio
--      delivery, 10 MiB, JPEG/PNG/WebP, zero anon/authenticated write or
--      folder-listing policies).
--   3. Adds server-only `public.customer_document_uploads` tracking table +
--      unique attachment partial indexes to cryptographically bind an uploaded
--      document/CV to a single quote or job application submission.
--   4. Adds server-only `public.project_photo_overrides` table so portfolio
--      photo updates from `/api/admin/photos` persist in PostgreSQL cleanly.
--   5. Revokes redundant browser-role `INSERT` grants from `008` on
--      `quote_requests`, `job_applications`, and `customer_feedback` so every
--      submission must pass through Next.js server validation, rate limiting,
--      idempotency, and attachment binding via `service_role`.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Storage Buckets (`customer-documents` private, `project-photos` public read)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'storage'
      AND table_name = 'buckets'
  ) THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'customer-documents',
      'customer-documents',
      FALSE,
      15728640,
      ARRAY[
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png',
        'image/webp'
      ]::text[]
    )
    ON CONFLICT (id) DO UPDATE
      SET public = FALSE,
          file_size_limit = EXCLUDED.file_size_limit,
          allowed_mime_types = EXCLUDED.allowed_mime_types;

    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'project-photos',
      'project-photos',
      TRUE,
      10485760,
      ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
    )
    ON CONFLICT (id) DO UPDATE
      SET public = TRUE,
          file_size_limit = EXCLUDED.file_size_limit,
          allowed_mime_types = EXCLUDED.allowed_mime_types;
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Customer Document Upload Binding Registry & Uniqueness Constraints
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_document_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id TEXT NOT NULL DEFAULT 'customer-documents'
    CHECK (bucket_id = 'customer-documents'),
  category TEXT NOT NULL
    CHECK (category IN ('documents', 'resumes')),
  storage_path TEXT UNIQUE NOT NULL
    CHECK (LENGTH(TRIM(storage_path)) > 0 AND storage_path NOT LIKE '%..%'),
  file_reference TEXT UNIQUE NOT NULL
    CHECK (file_reference LIKE 'supabase://customer-documents/%' AND file_reference NOT LIKE '%..%'),
  mime_type TEXT NOT NULL
    CHECK (
      mime_type IN (
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png',
        'image/webp'
      )
    ),
  byte_size INT NOT NULL
    CHECK (byte_size > 0 AND byte_size <= 15728640),
  claim_token_hash TEXT NOT NULL
    CHECK (LENGTH(TRIM(claim_token_hash)) = 64),
  claimed_by_table TEXT
    CHECK (claimed_by_table IS NULL OR claimed_by_table IN ('quote_requests', 'job_applications')),
  claimed_record_id UUID,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT customer_document_uploads_claim_state_check CHECK (
    (claimed_by_table IS NULL AND claimed_record_id IS NULL AND claimed_at IS NULL)
    OR
    (claimed_by_table IS NOT NULL AND claimed_record_id IS NOT NULL AND claimed_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS customer_document_uploads_unclaimed_idx
  ON public.customer_document_uploads (file_reference, category)
  WHERE claimed_at IS NULL;

ALTER TABLE public.customer_document_uploads ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS quote_requests_attachment_url_uidx
  ON public.quote_requests (attachment_url)
  WHERE attachment_url IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS job_applications_cv_url_uidx
  ON public.job_applications (cv_url)
  WHERE cv_url IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3. Portfolio Project Photo Overrides Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_photo_overrides (
  slug TEXT PRIMARY KEY
    CHECK (LENGTH(TRIM(slug)) > 0 AND slug NOT LIKE '%..%'),
  hero_image_url TEXT,
  gallery_image_urls JSONB,
  updated_by_staff_id UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS project_photo_overrides_touch_updated_at ON public.project_photo_overrides;
CREATE TRIGGER project_photo_overrides_touch_updated_at
  BEFORE UPDATE ON public.project_photo_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.cms_touch_updated_at();

ALTER TABLE public.project_photo_overrides ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 4. Revoke Direct Browser-Role INSERT Grants & Lock Server-Only Access
-- ----------------------------------------------------------------------------
REVOKE INSERT ON TABLE public.quote_requests FROM PUBLIC, anon, authenticated;
REVOKE INSERT ON TABLE public.job_applications FROM PUBLIC, anon, authenticated;
REVOKE INSERT ON TABLE public.customer_feedback FROM PUBLIC, anon, authenticated;

REVOKE ALL ON TABLE public.customer_document_uploads FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.project_photo_overrides FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_document_uploads TO service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.project_photo_overrides TO service_role;
  END IF;
END;
$$;
