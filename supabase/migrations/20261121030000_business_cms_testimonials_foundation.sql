-- ============================================================================
-- STROVYN BUSINESS CMS — PHASE C: TESTIMONIALS MANAGEMENT & MODERATION
-- Migration 012 (Additive, idempotent, staging-safe)
-- ============================================================================

-- 1. Extend public.testimonials with governance, consent, moderation, and ordering columns
ALTER TABLE public.testimonials
  ALTER COLUMN rating DROP DEFAULT;

ALTER TABLE public.testimonials
  DROP CONSTRAINT IF EXISTS testimonials_rating_check;

ALTER TABLE public.testimonials
  ADD CONSTRAINT testimonials_rating_check
  CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5));

ALTER TABLE public.testimonials
  ADD COLUMN IF NOT EXISTS customer_role TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS specification TEXT,
  ADD COLUMN IF NOT EXISTS related_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_feedback_id UUID REFERENCES public.customer_feedback(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS consent_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS consent_evidence TEXT,
  ADD COLUMN IF NOT EXISTS consent_verified_by UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS consent_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_by UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Constraints for moderation workflow and consent-gated publication
ALTER TABLE public.testimonials
  DROP CONSTRAINT IF EXISTS testimonials_moderation_status_check;

ALTER TABLE public.testimonials
  ADD CONSTRAINT testimonials_moderation_status_check
  CHECK (moderation_status IN ('draft', 'pending_review', 'approved', 'rejected', 'hidden'));

ALTER TABLE public.testimonials
  DROP CONSTRAINT IF EXISTS testimonials_published_requires_approval_consent_check;

ALTER TABLE public.testimonials
  ADD CONSTRAINT testimonials_published_requires_approval_consent_check
  CHECK (
    NOT is_published
    OR (
      moderation_status = 'approved'
      AND consent_verified = TRUE
      AND published_at IS NOT NULL
    )
  );

-- Prevent duplicate promotions from the same customer_feedback row
CREATE UNIQUE INDEX IF NOT EXISTS testimonials_source_feedback_uidx
  ON public.testimonials (source_feedback_id)
  WHERE source_feedback_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS testimonials_public_listing_idx
  ON public.testimonials (is_published, is_featured DESC, sort_order ASC, published_at DESC)
  WHERE is_published = TRUE AND moderation_status = 'approved' AND consent_verified = TRUE;

CREATE INDEX IF NOT EXISTS testimonials_moderation_status_idx
  ON public.testimonials (moderation_status, updated_at DESC);

-- 2. Touch updated_at automatically on update
CREATE OR REPLACE FUNCTION public.testimonials_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_testimonials_touch_updated_at ON public.testimonials;
CREATE TRIGGER trg_testimonials_touch_updated_at
  BEFORE UPDATE ON public.testimonials
  FOR EACH ROW
  EXECUTE FUNCTION public.testimonials_touch_updated_at();

-- 3. Lightweight moderation history table (staff/service_role only)
CREATE TABLE IF NOT EXISTS public.testimonial_moderation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  testimonial_id UUID NOT NULL REFERENCES public.testimonials(id) ON DELETE CASCADE,
  actor_staff_id UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS testimonial_moderation_events_tid_idx
  ON public.testimonial_moderation_events (testimonial_id, created_at DESC);

ALTER TABLE public.testimonial_moderation_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.testimonial_moderation_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.testimonial_moderation_events TO service_role;

-- 4. Update public RLS policy & grants on public.testimonials
DROP POLICY IF EXISTS "Public testimonials read" ON public.testimonials;
CREATE POLICY "Public testimonials read"
  ON public.testimonials
  FOR SELECT
  USING (
    is_published = TRUE
    AND moderation_status = 'approved'
    AND consent_verified = TRUE
  );

REVOKE ALL ON TABLE public.testimonials FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.testimonials TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.testimonials TO service_role;
