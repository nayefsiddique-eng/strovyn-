-- ============================================================================
-- STROVYN BUSINESS CMS — MIGRATION 011 (PHASE B: PROJECTS & PORTFOLIO CUTOVER)
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
--   4. Enforces least-privilege RLS + table grants: `anon` and `authenticated`
--      may SELECT only `visibility_status = 'published'` projects and their
--      images; all writes remain strictly server-only via `service_role`.
--   5. Idempotently seeds existing `PROJECTS_DATA` case studies:
--      - `the-north-adelaide-residence` -> `published` (preserves live URL & copy)
--      - 3 demonstration studies -> `draft` (`is_demonstration_spec = TRUE`)
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

-- ----------------------------------------------------------------------------
-- Least-privilege RLS & explicit table grants for public portfolio reads
-- ----------------------------------------------------------------------------
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public projects read" ON public.projects;
CREATE POLICY "Public projects read"
  ON public.projects
  FOR SELECT
  TO anon, authenticated
  USING (visibility_status = 'published');

DROP POLICY IF EXISTS "Public project images read" ON public.project_images;
CREATE POLICY "Public project images read"
  ON public.project_images
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_images.project_id
        AND p.visibility_status = 'published'
    )
  );

REVOKE ALL ON TABLE public.projects FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.project_images FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.projects TO anon, authenticated;
GRANT SELECT ON TABLE public.project_images TO anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.projects TO service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.project_images TO service_role;
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- Idempotent seed of established portfolio projects (`src/data/projectsData.ts`)
-- ----------------------------------------------------------------------------
INSERT INTO public.projects (
  slug,
  title,
  category,
  status,
  visibility_status,
  location,
  year,
  architect,
  builder,
  main_image_url,
  scope,
  finishes,
  description,
  short_description,
  challenges,
  sheen_levels,
  is_featured,
  is_demonstration_spec,
  sort_order,
  published_at
)
VALUES
  (
    'the-north-adelaide-residence',
    'North Adelaide Villa Residence',
    'Architectural Residential',
    'Completed',
    'published',
    'North Adelaide, SA',
    '2025',
    'Strovyn Architectural Finishing',
    'Strovyn Painting Co.',
    '/images/projects/adelaide-luxury-residence/living-dining-2.jpg',
    $sc$[
      "Comprehensive surface prep across open-plan living, kitchen and dining expanses",
      "Dust-controlled orbital machine sanding throughout architectural walls and ceilings",
      "Ultra-flat interior ceiling and low-sheen wall finishes catching natural daylight",
      "Precision masking and crisp hand-cut trim lines on custom cabinetry and architraves"
    ]$sc$::jsonb,
    'Substrate Skim // Low-VOC Mineral Matte // Fine Joinery & Trim Finish',
    'A benchmark Adelaide luxury home renovation showcasing Strovyn Painting Co.’s signature interior finish. Ultra-smooth walls, flawless light reflection, and impeccable architectural detailing in high-raking daylight.',
    'A benchmark Adelaide luxury home renovation showcasing Strovyn Painting Co.’s signature interior finish.',
    'Balancing bright daylight raking through floor-to-ceiling glass patio doors across seamless ceiling and wall surfaces with zero imperfections.',
    'Ceilings: Ultra-Flat 2% // Walls: Low-Sheen Matte 5% // Trim & Joinery: Satin 20%',
    TRUE,
    FALSE,
    1,
    '2025-06-01T00:00:00Z'
  ),
  (
    'adelaide-hills-coastal-estate',
    'Adelaide Hills Modern Estate',
    'Architectural Residential',
    'Active On-Site',
    'draft',
    'Crafers, Adelaide Hills SA',
    '2026',
    'Design Reference Spec [Client Case Study Pending]',
    'Prestige Regional Builder [Demonstration Study]',
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1800&q=80',
    $sc$[
      "Exterior facade weatherproofing and high-performance protective coatings",
      "Breathable mineral masonry coatings resistant to heavy temperature shifts",
      "Fine architectural woodwork and exposed structural timber lacquering"
    ]$sc$::jsonb,
    'Elastomeric Masonry Barrier // Silicate Exterior // Timber Satin Seal',
    'Specialized finishing demonstration designed for Adelaide Hills climate extremes. Balances UV resilience, moisture vapor permeability, and natural matte aesthetics.',
    'Specialized finishing demonstration designed for Adelaide Hills climate extremes.',
    'Wide diurnal temperature variations managed with flexible crack-bridging primers and moisture-equilibrium test protocols before application.',
    'Exterior Render: Low-Sheen 5% // Timber Elements: Satin 25%',
    FALSE,
    TRUE,
    2,
    NULL
  ),
  (
    'norwood-heritage-villa',
    'Norwood Victorian Villa Restoration',
    'Heritage Restoration',
    'Completed',
    'draft',
    'Norwood, Adelaide SA',
    '2024',
    'Heritage Conservation Spec [Demonstration Study]',
    'Craftsman Heritage Restorations [Demonstration Study]',
    'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1800&q=80',
    $sc$[
      "Gentle thermal removal of failed historical enamel on period woodwork",
      "Restoration of lath-and-plaster ceiling roses and decorative cornices",
      "Breathable period-authentic mineral coatings suited to bluestone masonry"
    ]$sc$::jsonb,
    'Breathable Distemper // Traditional Enamel // Lime Consolidation',
    'Heritage restoration portfolio specification celebrating Adelaide Victorian and Queen Anne architecture. Focuses on substrate preservation and period-correct chromatic balance.',
    'Heritage restoration portfolio specification celebrating Adelaide Victorian and Queen Anne architecture.',
    'Ensuring masonry can breathe freely without modern synthetic moisture entrapment.',
    'Ceilings & Plaster: Flat Chalk 1% // Woodwork: Traditional Gloss 65%',
    FALSE,
    TRUE,
    3,
    NULL
  ),
  (
    'unley-park-bespoke-residence',
    'Unley Park Residence & Joinery',
    'Artisanal Plasters',
    'Handover Phase',
    'draft',
    'Unley Park, Adelaide SA',
    '2026',
    'Interior Design Spec [Demonstration Study]',
    'Boutique Residential Builder [Demonstration Study]',
    'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1800&q=80',
    $sc$[
      "Burnished Venetian Marmorino feature walls and curved fireplace surround",
      "Fine cabinetry conversion lacquering across bespoke oak millwork",
      "Daylight inspection sign-off across all living zones"
    ]$sc$::jsonb,
    'Italian Marmorino // Catalyzed Joinery Polyurethane // Micro-Sanded Walls',
    'Tactile surface finishing demonstration highlighting the intersection between fine cabinetry lacquering and hand-troweled mineral plasters.',
    'Tactile surface finishing demonstration highlighting fine cabinetry lacquering and mineral plasters.',
    'Executing seamless curved plaster planes without visible lap marks under continuous raking downlights.',
    'Plaster: Hand-Burnished Wax 40% // Millwork: Velvet Matte 15%',
    FALSE,
    TRUE,
    4,
    NULL
  )
ON CONFLICT (slug) DO NOTHING;

-- Seed project_images only for projects that have zero image rows yet
WITH seed_images(project_slug, image_url, image_role, alt_text, sort_order) AS (
  VALUES
    ('the-north-adelaide-residence', '/images/projects/adelaide-luxury-residence/living-dining-2.jpg', 'cover', 'North Adelaide Villa Residence — Living and dining view', 0),
    ('the-north-adelaide-residence', '/images/projects/adelaide-luxury-residence/living-kitchen-1.jpg', 'gallery', 'North Adelaide Villa Residence — Living suite and kitchen junction', 1),
    ('the-north-adelaide-residence', '/images/projects/adelaide-luxury-residence/living-dining-2.jpg', 'gallery', 'North Adelaide Villa Residence — Open-plan living and dining', 2),
    ('the-north-adelaide-residence', '/images/projects/adelaide-luxury-residence/kitchen-island-patio-3.jpg', 'gallery', 'North Adelaide Villa Residence — Kitchen island and patio aspect', 3),
    ('adelaide-hills-coastal-estate', 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1800&q=80', 'cover', 'Adelaide Hills Modern Estate — Exterior facade', 0),
    ('adelaide-hills-coastal-estate', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80', 'gallery', 'Adelaide Hills Modern Estate — Architectural gallery 1', 1),
    ('adelaide-hills-coastal-estate', 'https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=1200&q=80', 'gallery', 'Adelaide Hills Modern Estate — Architectural gallery 2', 2),
    ('norwood-heritage-villa', 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1800&q=80', 'cover', 'Norwood Victorian Villa Restoration — Interior plasterwork', 0),
    ('norwood-heritage-villa', 'https://images.unsplash.com/photo-1600585152220-90363fe7e115?auto=format&fit=crop&w=1200&q=80', 'gallery', 'Norwood Victorian Villa Restoration — Detail view 1', 1),
    ('norwood-heritage-villa', 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=80', 'gallery', 'Norwood Victorian Villa Restoration — Detail view 2', 2),
    ('unley-park-bespoke-residence', 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1800&q=80', 'cover', 'Unley Park Residence & Joinery — Venetian plaster and joinery', 0),
    ('unley-park-bespoke-residence', 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80', 'gallery', 'Unley Park Residence & Joinery — Gallery view 1', 1),
    ('unley-park-bespoke-residence', 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=80', 'gallery', 'Unley Park Residence & Joinery — Gallery view 2', 2)
)
INSERT INTO public.project_images (project_id, image_url, image_role, alt_text, sort_order)
SELECT p.id, s.image_url, s.image_role, s.alt_text, s.sort_order
FROM seed_images s
JOIN public.projects p ON p.slug = s.project_slug
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_images pi WHERE pi.project_id = p.id
);
