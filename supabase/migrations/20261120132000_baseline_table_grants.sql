-- ============================================================================
-- STROVYN — MIGRATION 008 (BASELINE NON-CMS TABLE GRANTS)
-- Additive migration preserving 001–007 and all existing RLS policies untouched.
--
-- Scope:
--   Trace 001 non-CMS tables to actual callers in `src/`:
--   - `quote_requests`, `job_applications`, `customer_feedback`:
--     Actively inserted (without RETURNING/SELECT) via `createClient()`
--     (`src/lib/supabase/server.ts`, anon/authenticated role) in
--     `/api/quotes`, `/api/applications`, and `/api/feedback` (`mockData.ts`).
--     Covered by 001 INSERT RLS policies; zero SELECT/UPDATE/DELETE grants
--     so private submissions remain unreadable to anon/authenticated callers.
--   - `profiles`, `company_settings`, `services`, `projects`,
--     `project_images`, `testimonials`, `job_openings`:
--     Zero runtime Supabase callers in `src/`. Revoke browser/client access;
--     grant server `service_role` management access while keeping 001 RLS intact.
-- ============================================================================

REVOKE ALL ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.company_settings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.services FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.projects FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.project_images FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.testimonials FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.job_openings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.job_applications FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.quote_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.customer_feedback FROM PUBLIC, anon, authenticated;

-- Submission tables actively written by public API routes via server.ts (anon/authenticated)
GRANT INSERT ON TABLE public.quote_requests TO anon, authenticated;
GRANT INSERT ON TABLE public.job_applications TO anon, authenticated;
GRANT INSERT ON TABLE public.customer_feedback TO anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.company_settings TO service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.services TO service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.projects TO service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.project_images TO service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.testimonials TO service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.job_openings TO service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.job_applications TO service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.quote_requests TO service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_feedback TO service_role;
  END IF;
END;
$$;
