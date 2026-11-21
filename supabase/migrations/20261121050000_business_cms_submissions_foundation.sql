-- ============================================================================
-- STROVYN BUSINESS CMS — PHASE E: UNIFIED SUBMISSIONS & PRIVATE DOCUMENTS
-- Migration 014 (Additive, idempotent, staging-safe)
-- ============================================================================

-- 1. Extend quote_requests, job_applications, and customer_feedback with
--    optimistic concurrency timestamps, staff attribution, and internal notes
ALTER TABLE public.quote_requests
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.customer_feedback
  ADD COLUMN IF NOT EXISTS admin_notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 2. Status CHECK constraints
ALTER TABLE public.quote_requests
  DROP CONSTRAINT IF EXISTS quote_requests_status_check;

ALTER TABLE public.quote_requests
  ADD CONSTRAINT quote_requests_status_check
  CHECK (status IN ('pending', 'reviewed', 'quoted', 'closed'));

ALTER TABLE public.job_applications
  DROP CONSTRAINT IF EXISTS job_applications_status_check;

ALTER TABLE public.job_applications
  ADD CONSTRAINT job_applications_status_check
  CHECK (status IN ('pending', 'reviewing', 'interviewed', 'rejected', 'hired'));

ALTER TABLE public.customer_feedback
  DROP CONSTRAINT IF EXISTS customer_feedback_status_check;

ALTER TABLE public.customer_feedback
  ADD CONSTRAINT customer_feedback_status_check
  CHECK (status IN ('pending', 'reviewed', 'approved', 'rejected', 'archived'));

-- 3. Stable pagination & filtering indexes
CREATE INDEX IF NOT EXISTS quote_requests_admin_list_idx
  ON public.quote_requests (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS job_applications_admin_list_idx
  ON public.job_applications (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS customer_feedback_admin_list_idx
  ON public.customer_feedback (created_at DESC, id DESC);

-- 4. Touch updated_at automatically on submission status / notes updates
CREATE OR REPLACE FUNCTION public.submissions_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quote_requests_touch_updated_at ON public.quote_requests;
CREATE TRIGGER trg_quote_requests_touch_updated_at
  BEFORE UPDATE ON public.quote_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.submissions_touch_updated_at();

DROP TRIGGER IF EXISTS trg_job_applications_touch_updated_at ON public.job_applications;
CREATE TRIGGER trg_job_applications_touch_updated_at
  BEFORE UPDATE ON public.job_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.submissions_touch_updated_at();

DROP TRIGGER IF EXISTS trg_customer_feedback_touch_updated_at ON public.customer_feedback;
CREATE TRIGGER trg_customer_feedback_touch_updated_at
  BEFORE UPDATE ON public.customer_feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.submissions_touch_updated_at();

-- 5. Server-only audit log for submission updates and private attachment downloads
CREATE TABLE IF NOT EXISTS public.submission_access_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_table TEXT NOT NULL
    CHECK (submission_table IN ('quote_requests', 'job_applications', 'customer_feedback')),
  submission_id UUID NOT NULL,
  actor_staff_id UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS submission_access_events_lookup_idx
  ON public.submission_access_events (submission_table, submission_id, created_at DESC);

ALTER TABLE public.submission_access_events ENABLE ROW LEVEL SECURITY;

-- 6. Strictly lock all submission & document tables to service_role only
REVOKE ALL ON TABLE public.quote_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.job_applications FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.customer_feedback FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.customer_document_uploads FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.submission_access_events FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.quote_requests TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.job_applications TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_feedback TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_document_uploads TO service_role;
GRANT SELECT, INSERT ON TABLE public.submission_access_events TO service_role;
