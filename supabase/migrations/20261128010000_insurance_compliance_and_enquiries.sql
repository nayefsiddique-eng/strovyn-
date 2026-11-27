-- ============================================================================
-- STROVYN — MIGRATION 018: PUBLIC LIABILITY INSURANCE ENQUIRIES, INCIDENT
-- REPORTING & POLICY COMPLIANCE GOVERNANCE
--
-- Additive, idempotent migration preserving all existing tables & RLS intact:
--   1. Private storage buckets: `compliance-documents` and `incident-attachments`
--      (strictly private, zero public/anon/authenticated policies).
--   2. `public.public_liability_insurance` (policy governance, unpublished by
--      default until verified client Certificate of Currency is provided).
--   3. `public.insurance_enquiries` (Option A: information requests &
--      Option B: incident reports, independent of policy publication state).
--   4. `public.insurance_incident_attachments` (bound private incident photos
--      with strict MIME/size checks and retention horizon).
--   5. `public.insurance_enquiry_audit_log` (append-only staff audit log).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Private Storage Buckets (`compliance-documents` & `incident-attachments`)
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

    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'incident-attachments',
      'incident-attachments',
      FALSE,
      10485760,
      ARRAY[
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
-- 2. Policy Compliance Governance (`public.public_liability_insurance`)
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
-- 3. Customer Insurance Enquiries & Incident Reports (`public.insurance_enquiries`)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.insurance_enquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code TEXT NOT NULL UNIQUE
    CHECK (char_length(trim(reference_code)) BETWEEN 8 AND 40),
  enquiry_kind TEXT NOT NULL
    CHECK (enquiry_kind IN ('information_request', 'incident_report')),
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'under_review', 'awaiting_customer', 'referred_to_insurer', 'closed')),
  is_urgent BOOLEAN NOT NULL DEFAULT FALSE,

  full_name TEXT NOT NULL
    CHECK (char_length(trim(full_name)) BETWEEN 2 AND 120),
  email TEXT NOT NULL
    CHECK (char_length(trim(email)) BETWEEN 5 AND 160),
  phone TEXT
    CHECK (phone IS NULL OR char_length(trim(phone)) <= 40),
  project_location TEXT
    CHECK (project_location IS NULL OR char_length(trim(project_location)) <= 200),

  -- Option A: Request Insurance Information
  request_type TEXT
    CHECK (request_type IS NULL OR request_type IN ('certificate_of_currency', 'coverage_enquiry', 'other')),
  message TEXT
    CHECK (message IS NULL OR char_length(message) <= 3000),

  -- Option B: Report an Incident
  incident_date DATE,
  incident_category TEXT
    CHECK (incident_category IS NULL OR incident_category IN ('property_damage', 'injury', 'other')),
  incident_description TEXT
    CHECK (incident_description IS NULL OR char_length(incident_description) <= 4000),
  disclaimer_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,

  -- Admin CMS Workflow & Resolution Tracking
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  internal_notes TEXT
    CHECK (internal_notes IS NULL OR char_length(internal_notes) <= 5000),
  follow_up_actions TEXT
    CHECK (follow_up_actions IS NULL OR char_length(follow_up_actions) <= 5000),
  closed_at TIMESTAMPTZ,
  closed_by UUID,

  idempotency_key TEXT UNIQUE
    CHECK (idempotency_key IS NULL OR char_length(trim(idempotency_key)) BETWEEN 8 AND 128),

  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT chk_insurance_info_request_fields
    CHECK (
      enquiry_kind <> 'information_request' OR (
        request_type IS NOT NULL
      )
    ),

  CONSTRAINT chk_insurance_incident_report_fields
    CHECK (
      enquiry_kind <> 'incident_report' OR (
        phone IS NOT NULL AND char_length(trim(phone)) >= 6 AND
        project_location IS NOT NULL AND char_length(trim(project_location)) >= 2 AND
        incident_date IS NOT NULL AND
        incident_category IS NOT NULL AND
        incident_description IS NOT NULL AND char_length(trim(incident_description)) >= 10 AND
        disclaimer_acknowledged = TRUE
      )
    )
);

CREATE INDEX IF NOT EXISTS idx_insurance_enquiries_created_at
  ON public.insurance_enquiries (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_insurance_enquiries_status_kind
  ON public.insurance_enquiries (status, enquiry_kind, is_urgent);

-- ----------------------------------------------------------------------------
-- 4. Private Incident Supporting Photographs (`public.insurance_incident_attachments`)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.insurance_incident_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id UUID NOT NULL REFERENCES public.insurance_enquiries(id) ON DELETE CASCADE,
  bucket_id TEXT NOT NULL DEFAULT 'incident-attachments'
    CHECK (bucket_id = 'incident-attachments'),
  storage_path TEXT NOT NULL UNIQUE
    CHECK (char_length(trim(storage_path)) > 0 AND position('..' in storage_path) = 0),
  original_label TEXT NOT NULL
    CHECK (char_length(trim(original_label)) BETWEEN 1 AND 140),
  mime_type TEXT NOT NULL
    CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  byte_size INTEGER NOT NULL
    CHECK (byte_size > 0 AND byte_size <= 10485760),
  retention_until TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now()) + INTERVAL '365 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_insurance_incident_attachments_enquiry
  ON public.insurance_incident_attachments (enquiry_id);

CREATE INDEX IF NOT EXISTS idx_insurance_incident_attachments_retention
  ON public.insurance_incident_attachments (retention_until ASC);

-- ----------------------------------------------------------------------------
-- 5. Immutable Insurance Enquiry Audit Log (`public.insurance_enquiry_audit_log`)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.insurance_enquiry_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id UUID REFERENCES public.insurance_enquiries(id) ON DELETE SET NULL,
  actor_staff_id UUID,
  action TEXT NOT NULL
    CHECK (
      action IN (
        'created',
        'viewed',
        'marked_reviewed',
        'status_changed',
        'notes_updated',
        'urgent_toggled',
        'closed',
        'attachment_downloaded',
        'exported'
      )
    ),
  from_status TEXT,
  to_status TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_insurance_enquiry_audit_enquiry
  ON public.insurance_enquiry_audit_log (enquiry_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 6. Row-Level Security & Strict Least-Privilege Table Grants
-- ----------------------------------------------------------------------------
ALTER TABLE public.public_liability_insurance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_incident_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_enquiry_audit_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.public_liability_insurance FROM PUBLIC;
REVOKE ALL ON TABLE public.insurance_enquiries FROM PUBLIC;
REVOKE ALL ON TABLE public.insurance_incident_attachments FROM PUBLIC;
REVOKE ALL ON TABLE public.insurance_enquiry_audit_log FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE public.public_liability_insurance FROM anon;
    REVOKE ALL ON TABLE public.insurance_enquiries FROM anon;
    REVOKE ALL ON TABLE public.insurance_incident_attachments FROM anon;
    REVOKE ALL ON TABLE public.insurance_enquiry_audit_log FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public.public_liability_insurance FROM authenticated;
    REVOKE ALL ON TABLE public.insurance_enquiries FROM authenticated;
    REVOKE ALL ON TABLE public.insurance_incident_attachments FROM authenticated;
    REVOKE ALL ON TABLE public.insurance_enquiry_audit_log FROM authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.public_liability_insurance TO service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.insurance_enquiries TO service_role;
    GRANT SELECT, INSERT, DELETE ON TABLE public.insurance_incident_attachments TO service_role;
    GRANT SELECT, INSERT ON TABLE public.insurance_enquiry_audit_log TO service_role;
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. Automatic `updated_at` Triggers
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.insurance_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.insurance_touch_updated_at() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_public_liability_insurance_updated_at ON public.public_liability_insurance;
CREATE TRIGGER trg_public_liability_insurance_updated_at
  BEFORE UPDATE ON public.public_liability_insurance
  FOR EACH ROW
  EXECUTE FUNCTION public.insurance_touch_updated_at();

DROP TRIGGER IF EXISTS trg_insurance_enquiries_updated_at ON public.insurance_enquiries;
CREATE TRIGGER trg_insurance_enquiries_updated_at
  BEFORE UPDATE ON public.insurance_enquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.insurance_touch_updated_at();
