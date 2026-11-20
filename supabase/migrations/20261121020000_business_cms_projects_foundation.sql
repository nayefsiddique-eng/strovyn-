-- ============================================================================
-- STROVYN BUSINESS CMS — MIGRATION 011 (PHASE B: PROJECTS & PORTFOLIO FOUNDATION)
-- Additive, non-destructive migration preserving 001–010 intact.
--
-- Scope:
--   1. Extends `public.projects` with publication governance (`visibility_status`),
--      case-study metadata (`year`, `architect`, `builder`, `scope`, `finishes`,
--      `challenges`, `sheen_levels`), SEO metadata, sort ordering, and staff
--      attribution (`created_by`, `updated_by`).
--   2. Extends `public.project_images` with explicit image roles (`cover`,
--      `gallery`, `before`, `after`), `alt_text`, before/after `pair_key`,
--      and `storage_path`.
--   3. Attaches `cms_touch_updated_at()` trigger on `public.projects`.
-- ============================================================================

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS visibility_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (visibility_status IN ('draft', 'published', 'archived')),
  ADD COLUMN IF NOT EXISTS year TEXT,
  ADD COLUMN IF NOT EXISTS architect TEXT,
  ADD COLUMN IF NOT EXISTS builder TEXT,
  ADD COLUMN IF NOT EXISTS scope JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS finishes TEXT,
  ADD COLUMN IF NOT EXISTS challenges TEXT,
  ADD COLUMN IF NOT EXISTS sheen_levels TEXT,
  ADD COLUMN IF NOT EXISTS seo_title TEXT,
  ADD COLUMN IF NOT EXISTS seo_description TEXT,
  ADD COLUMN IF NOT EXISTS is_demonstration_spec BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.staff_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS projects_visibility_sort_idx
  ON public.projects (visibility_status, sort_order ASC, created_at DESC);

DROP TRIGGER IF EXISTS projects_touch_updated_at ON public.projects;
CREATE TRIGGER projects_touch_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.cms_touch_updated_at();

ALTER TABLE public.project_images
  ADD COLUMN IF NOT EXISTS image_role TEXT NOT NULL DEFAULT 'gallery'
    CHECK (image_role IN ('cover', 'gallery', 'before', 'after')),
  ADD COLUMN IF NOT EXISTS alt_text TEXT,
  ADD COLUMN IF NOT EXISTS pair_key TEXT,
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS project_images_project_order_idx
  ON public.project_images (project_id, sort_order ASC);
