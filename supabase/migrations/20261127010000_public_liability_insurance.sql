-- ============================================================================
-- STROVYN — MIGRATION 017 (PUBLIC LIABILITY INSURANCE & COMPLIANCE GOVERNANCE)
-- Additive migration preserving all existing tables and RLS intact.
--
-- Features:
--   1. Provisions private `compliance-documents` Storage bucket (15 MiB,
--      PDF/JPEG/PNG/WebP, strictly private with zero public access).
--   2. Creates `public.public_liability_insurance` table for policy governance.
--   3. Strict DB-level constraints:
--      - `coverage_limit_aud > 0`
--      - `policy_expiry_date >= policy_commencement_date`
--      - `chk_insurance_published_prerequisites`: if `is_published = true`,
--        provider_name, named_insured, policy_number, and certificate_storage_path
--        MUST be non-empty.
--   4. RLS enabled: Revokes direct table access from `anon` and `authenticated`.
--      Only `service_role` has full administrative and delivery grants.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Private Storage Bucket: compliance-documents
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
      'compliance-documents',
      'compliance-documents',
      FALSE,
      15728640,
      ARRAY[
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp'
      ]::text[]
    )
    ON CONFLICT (id) DO UPDATE
      SET public = FALSE,
          file_size_limit = EXCLUDED.file_size_limit,
          allowed_mime_types = EXCLUDED.allowed_mime_types;
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Table: public.public_liability_insurance
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.public_liability_insurance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name TEXT NOT NULL DEFAULT '',
  named_insured TEXT NOT NULL DEFAULT '',
  policy_number TEXT NOT NULL DEFAULT '',
  coverage_limit_aud NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  policy_commencement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  policy_expiry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  certificate_storage_path TEXT,
  exclusions_summary TEXT,
  public_statement TEXT NOT NULL DEFAULT 'STROVYN maintains public liability insurance in accordance with its current policy. Details of applicable cover can be provided upon request.',
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  verified_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT chk_insurance_expiry_after_commencement
    CHECK (policy_expiry_date >= policy_commencement_date),

  CONSTRAINT chk_insurance_published_prerequisites
    CHECK (
      NOT is_published OR (
        char_length(trim(provider_name)) > 0 AND
        char_length(trim(named_insured)) > 0 AND
        char_length(trim(policy_number)) > 0 AND
        coverage_limit_aud > 0 AND
        certificate_storage_path IS NOT NULL AND
        char_length(trim(certificate_storage_path)) > 0
      )
    )
);

-- ----------------------------------------------------------------------------
-- 3. Row-Level Security & Privilege Grants
-- ----------------------------------------------------------------------------
ALTER TABLE public.public_liability_insurance ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE public.public_liability_insurance FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public.public_liability_insurance FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.public_liability_insurance TO service_role;
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Automatic updated_at Trigger
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_updated_at_column'
  ) THEN
    DROP TRIGGER IF EXISTS trg_public_liability_insurance_updated_at ON public.public_liability_insurance;
    CREATE TRIGGER trg_public_liability_insurance_updated_at
      BEFORE UPDATE ON public.public_liability_insurance
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END;
$$;
