-- ============================================================================
-- STROVYN EDITORIAL CMS — MIGRATION 003 (CMS-1)
-- Additive migration preserving 001_initial_schema.sql and
-- 002_idempotency_and_hardening.sql untouched.
--
-- Features:
--   1. Staff registry table (`staff_users`) with invite-only RBAC roles
--      ('editor', 'publisher', 'admin') and `is_active` enforcement.
--   2. Safe extension of `articles` table for complete 6-state editorial
--      workflow ('draft', 'review', 'approved', 'scheduled', 'published',
--      'archived'), structured JSON/HTML content, SEO metadata, scheduling,
--      retry backoff tracking, and staff attribution columns.
--   3. Safe handling of any legacy `articles.status` constraint before enforcing
--      new editorial status & schedule invariants.
--   4. Append-only immutable `article_audit_log` with mutation protection.
--   5. Least-privilege RLS policies preventing public exposure of unpublished
--      content and preventing staff self-escalation or client-side mutation.
--   6. Idempotent seeding of the 7 existing static articles (`ON CONFLICT DO NOTHING`)
--      according to the Phase 0.1 content integrity policy:
--        - Published (3): #1, #5, #7
--        - Review    (3): #2, #3, #6
--        - Draft     (1): #4 (`lead-safe-conservation-protocols-heritage-homes`)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Timestamp maintenance helper
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cms_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Individual staff RBAC table (`staff_users`)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('editor', 'publisher', 'admin')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  invited_by UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS staff_users_email_lower_uidx
  ON public.staff_users (LOWER(email));

CREATE INDEX IF NOT EXISTS staff_users_active_role_idx
  ON public.staff_users (role, is_active)
  WHERE is_active = TRUE;

DROP TRIGGER IF EXISTS staff_users_touch_updated_at ON public.staff_users;
CREATE TRIGGER staff_users_touch_updated_at
  BEFORE UPDATE ON public.staff_users
  FOR EACH ROW
  EXECUTE FUNCTION public.cms_touch_updated_at();

ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;

-- Staff members may read only their own active profile row via user JWT;
-- all staff creation, role assignment, and deactivation happen strictly
-- server-side through the service-role client after admin verification.
DROP POLICY IF EXISTS "Staff can read own active profile" ON public.staff_users;
CREATE POLICY "Staff can read own active profile"
  ON public.staff_users
  FOR SELECT
  TO authenticated
  USING (auth_user_id = (SELECT auth.uid()) AND is_active = TRUE);

-- ----------------------------------------------------------------------------
-- 3. Extend `articles` table additively & safely migrate status constraints
-- ----------------------------------------------------------------------------
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS subtitle TEXT,
  ADD COLUMN IF NOT EXISTS content_json JSONB,
  ADD COLUMN IF NOT EXISTS content_html TEXT,
  ADD COLUMN IF NOT EXISTS featured_image_alt TEXT,
  ADD COLUMN IF NOT EXISTS og_image_url TEXT,
  ADD COLUMN IF NOT EXISTS seo_title TEXT,
  ADD COLUMN IF NOT EXISTS seo_description TEXT,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS author_name TEXT NOT NULL DEFAULT 'Strovyn Painting Co.',
  ADD COLUMN IF NOT EXISTS author_role TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS publish_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_publish_error TEXT,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_by UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES public.staff_users(id) ON DELETE SET NULL;

-- Safely inspect and drop any prior CHECK constraints on `articles.status` or
-- `scheduled_at` before replacing them with the 6-state editorial constraints.
DO $$
DECLARE
  constraint_row RECORD;
BEGIN
  FOR constraint_row IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.articles'::regclass
      AND contype = 'c'
      AND (
        pg_get_constraintdef(oid) ~* '\mstatus\M'
        OR conname IN (
          'articles_status_check',
          'articles_scheduled_requires_timestamp_check',
          'articles_publish_attempts_non_negative_check'
        )
      )
  LOOP
    EXECUTE format('ALTER TABLE public.articles DROP CONSTRAINT IF EXISTS %I', constraint_row.conname);
  END LOOP;
END;
$$;

-- Normalize any legacy NULL or unexpected status values safely before adding CHECK.
UPDATE public.articles
SET status = CASE
  WHEN status IS NULL OR TRIM(status) = '' THEN 'draft'
  WHEN LOWER(TRIM(status)) IN ('draft', 'review', 'approved', 'scheduled', 'published', 'archived')
    THEN LOWER(TRIM(status))
  ELSE 'draft'
END
WHERE status IS NULL
   OR status <> LOWER(TRIM(status))
   OR LOWER(TRIM(status)) NOT IN ('draft', 'review', 'approved', 'scheduled', 'published', 'archived');

ALTER TABLE public.articles
  ALTER COLUMN status SET DEFAULT 'draft',
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.articles
  ADD CONSTRAINT articles_status_check
    CHECK (status IN ('draft', 'review', 'approved', 'scheduled', 'published', 'archived')),
  ADD CONSTRAINT articles_scheduled_requires_timestamp_check
    CHECK (status <> 'scheduled' OR scheduled_at IS NOT NULL),
  ADD CONSTRAINT articles_publish_attempts_non_negative_check
    CHECK (publish_attempts >= 0);

-- Performance & feed indexes for published reads and scheduled publishing queries
CREATE INDEX IF NOT EXISTS articles_published_feed_idx
  ON public.articles (published_at DESC, created_at DESC)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS articles_scheduled_due_idx
  ON public.articles (scheduled_at ASC)
  WHERE status = 'scheduled';

CREATE INDEX IF NOT EXISTS articles_status_updated_idx
  ON public.articles (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS articles_category_published_idx
  ON public.articles (category, published_at DESC)
  WHERE status = 'published';

DROP TRIGGER IF EXISTS articles_touch_updated_at ON public.articles;
CREATE TRIGGER articles_touch_updated_at
  BEFORE UPDATE ON public.articles
  FOR EACH ROW
  EXECUTE FUNCTION public.cms_touch_updated_at();

-- Tighten public read RLS on `articles` so scheduled, future-dated, draft,
-- review, approved, and archived articles are strictly invisible to anon and
-- non-service-role clients.
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public articles read" ON public.articles;
CREATE POLICY "Public articles read"
  ON public.articles
  FOR SELECT
  USING (
    status = 'published'
    AND (published_at IS NULL OR published_at <= NOW())
  );

-- ----------------------------------------------------------------------------
-- 4. Immutable editorial revision & transition audit log (`article_audit_log`)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.article_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE RESTRICT,
  actor_staff_id UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
  actor_type TEXT NOT NULL DEFAULT 'staff'
    CHECK (actor_type IN ('staff', 'cron', 'migration')),
  actor_email TEXT,
  actor_role TEXT
    CHECK (actor_role IS NULL OR actor_role IN ('editor', 'publisher', 'admin', 'system')),
  action TEXT NOT NULL,
  from_status TEXT
    CHECK (from_status IS NULL OR from_status IN ('draft', 'review', 'approved', 'scheduled', 'published', 'archived')),
  to_status TEXT
    CHECK (to_status IS NULL OR to_status IN ('draft', 'review', 'approved', 'scheduled', 'published', 'archived')),
  note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS article_audit_log_article_idx
  ON public.article_audit_log (article_id, created_at DESC);

CREATE INDEX IF NOT EXISTS article_audit_log_actor_idx
  ON public.article_audit_log (actor_staff_id, created_at DESC)
  WHERE actor_staff_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.prevent_article_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'article_audit_log is append-only; UPDATE and DELETE operations are prohibited';
END;
$$;

DROP TRIGGER IF EXISTS article_audit_log_immutable_guard ON public.article_audit_log;
CREATE TRIGGER article_audit_log_immutable_guard
  BEFORE UPDATE OR DELETE ON public.article_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_article_audit_log_mutation();

ALTER TABLE public.article_audit_log ENABLE ROW LEVEL SECURITY;
-- Zero anon/authenticated policies: audit logs are readable & writable strictly
-- via server-only service-role paths after RBAC authorization.

-- ----------------------------------------------------------------------------
-- 5. Idempotent article seeding (`src/data/articlesData.ts` Tiered Policy)
-- ----------------------------------------------------------------------------
INSERT INTO public.articles (
  slug,
  title,
  category,
  excerpt,
  content,
  content_json,
  content_html,
  featured_image_url,
  featured_image_alt,
  status,
  is_featured,
  reading_time,
  author_name,
  author_role,
  published_at,
  created_at,
  updated_at
)
VALUES
  -- Article 1 -> published (featured)
  (
    'achieving-as-nzs-2311-level-5-surface-standards',
    'Achieving Level 5 Surface Standards in High-Raking Sunlight',
    'Surface Preparation',
    $art$Why standard plasterboard joints fail under low-angle morning sunlight and the systematic skim protocol required to eliminate joint telegraphing.$art$,
    $art$In contemporary residential architecture, expansive glazing units and minimalist shadow-line reveals have transformed ceilings into architectural focal points. However, this architectural freedom brings a merciless physical reality: raking light.

Under low sun angles, standard Level 4 drywall tape joints reflect light differently than the surrounding plasterboard paper. Even with multiple coats of conventional low-sheen acrylic, optical telegraphing occurs, resulting in visible seam ridges and surface flashing.

A Level 5 finish requires an unbroken skim coat across the entire plasterboard substrate. This equalises suction, surface texture and optical reflectance prior to pigment application.

During preparation, raking cross-light inspection is used to identify any surface deflection before the final finish coat is applied.$art$,
    jsonb_build_object(
      'type', 'doc',
      'content', jsonb_build_array(
        jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', $art$In contemporary residential architecture, expansive glazing units and minimalist shadow-line reveals have transformed ceilings into architectural focal points. However, this architectural freedom brings a merciless physical reality: raking light.$art$))),
        jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', $art$Under low sun angles, standard Level 4 drywall tape joints reflect light differently than the surrounding plasterboard paper. Even with multiple coats of conventional low-sheen acrylic, optical telegraphing occurs, resulting in visible seam ridges and surface flashing.$art$))),
        jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', $art$A Level 5 finish requires an unbroken skim coat across the entire plasterboard substrate. This equalises suction, surface texture and optical reflectance prior to pigment application.$art$))),
        jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', $art$During preparation, raking cross-light inspection is used to identify any surface deflection before the final finish coat is applied.$art$)))
      )
    ),
    $art$<p>In contemporary residential architecture, expansive glazing units and minimalist shadow-line reveals have transformed ceilings into architectural focal points. However, this architectural freedom brings a merciless physical reality: raking light.</p><p>Under low sun angles, standard Level 4 drywall tape joints reflect light differently than the surrounding plasterboard paper. Even with multiple coats of conventional low-sheen acrylic, optical telegraphing occurs, resulting in visible seam ridges and surface flashing.</p><p>A Level 5 finish requires an unbroken skim coat across the entire plasterboard substrate. This equalises suction, surface texture and optical reflectance prior to pigment application.</p><p>During preparation, raking cross-light inspection is used to identify any surface deflection before the final finish coat is applied.</p>$art$,
    '/images/architectural-paint-swatch.jpg',
    'Architectural neutral paint swatch sample showing surface smoothness under angled studio light',
    'published',
    TRUE,
    6,
    'Strovyn Painting Co.',
    'Surface Preparation',
    '2026-02-12T00:00:00Z',
    '2026-02-12T00:00:00Z',
    '2026-02-12T00:00:00Z'
  ),

  -- Article 2 -> review
  (
    'chemistry-of-potassium-silicate-mineral-coatings',
    'The Mineral Chemistry of Pure Potassium Silicate Coatings',
    'Paint Chemistry',
    $art$Unlike acrylic films that form a synthetic skin over masonry, potassium waterglass chemically petrifies into the substrate for century-long permanence.$art$,
    $art$Conventional exterior paints rely on organic acrylic resins that form a synthetic barrier over masonry. While flexible initially, UV radiation and thermal cycling inevitably cause polymer chain degradation, leading to micro-blistering and chalking.

Potassium silicate coatings, first formulated in 19th-century Bavaria, rely on waterglass (silicic acid potassium salt). When applied to mineral substrates like lime render or concrete, a chemical reaction known as silicification occurs.

The binder reacts with available calcium hydroxide and mineral compounds within suitable masonry substrates to form insoluble calcium silicate hydrate. Rather than forming only a surface film, the coating chemically bonds with suitable mineral substrates through the silicification process.

Achieving Class 1 vapor permeability under the European EN 1062-1 classification standard, moisture can evaporate naturally from within the wall envelope while external rain penetration is resisted, helping address one of the principal causes of masonry decay in variable climates.$art$,
    jsonb_build_object(
      'type', 'doc',
      'content', jsonb_build_array(
        jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', $art$Conventional exterior paints rely on organic acrylic resins that form a synthetic barrier over masonry. While flexible initially, UV radiation and thermal cycling inevitably cause polymer chain degradation, leading to micro-blistering and chalking.$art$))),
        jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', $art$Potassium silicate coatings, first formulated in 19th-century Bavaria, rely on waterglass (silicic acid potassium salt). When applied to mineral substrates like lime render or concrete, a chemical reaction known as silicification occurs.$art$))),
        jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', $art$The binder reacts with available calcium hydroxide and mineral compounds within suitable masonry substrates to form insoluble calcium silicate hydrate. Rather than forming only a surface film, the coating chemically bonds with suitable mineral substrates through the silicification process.$art$))),
        jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', $art$Achieving Class 1 vapor permeability under the European EN 1062-1 classification standard, moisture can evaporate naturally from within the wall envelope while external rain penetration is resisted, helping address one of the principal causes of masonry decay in variable climates.$art$)))
      )
    ),
    $art$<p>Conventional exterior paints rely on organic acrylic resins that form a synthetic barrier over masonry. While flexible initially, UV radiation and thermal cycling inevitably cause polymer chain degradation, leading to micro-blistering and chalking.</p><p>Potassium silicate coatings, first formulated in 19th-century Bavaria, rely on waterglass (silicic acid potassium salt). When applied to mineral substrates like lime render or concrete, a chemical reaction known as silicification occurs.</p><p>The binder reacts with available calcium hydroxide and mineral compounds within suitable masonry substrates to form insoluble calcium silicate hydrate. Rather than forming only a surface film, the coating chemically bonds with suitable mineral substrates through the silicification process.</p><p>Achieving Class 1 vapor permeability under the European EN 1062-1 classification standard, moisture can evaporate naturally from within the wall envelope while external rain penetration is resisted, helping address one of the principal causes of masonry decay in variable climates.</p>$art$,
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
    'Contemporary rendered residential exterior finished in matte mineral tones',
    'review',
    FALSE,
    5,
    'Strovyn Painting Co.',
    'Paint Chemistry',
    NULL,
    '2026-01-28T00:00:00Z',
    '2026-01-28T00:00:00Z'
  ),

  -- Article 3 -> review
  (
    'authentic-venetian-plaster-vs-synthetic-render',
    $art$Authentic Slaked Lime Plaster vs. Synthetic Textures: The Architect’s Guide$art$,
    'Painting Techniques',
    $art$Evaluating luminescence, tactile cooling, and acoustic properties between historical marmorino and modern acrylic faux finishes.$art$,
    $art$The resurgence of tactile, monolithic wall finishes in luxury residences has created widespread confusion between authentic lime-based plasters and synthetic acrylic-based textured pastes.

Authentic Venetian Marmorino consists of aged slaked lime (calcium hydroxide) blended with crushed Carrara marble dust. It cures through natural carbonation—absorbing ambient carbon dioxide from the air to revert back to solid limestone rock.

This crystalline carbonation creates a microscopic translucency where ambient light penetrates beneath the surface before scattering, imparting a luminous depth that conventional synthetic paints do not replicate through the same mechanism.

Furthermore, genuine lime plasters remain naturally alkaline (pH 12–13), making them inherently resistant to mold, bacteria, and electrostatic dust accumulation.$art$,
    jsonb_build_object(
      'type', 'doc',
      'content', jsonb_build_array(
        jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', $art$The resurgence of tactile, monolithic wall finishes in luxury residences has created widespread confusion between authentic lime-based plasters and synthetic acrylic-based textured pastes.$art$))),
        jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', $art$Authentic Venetian Marmorino consists of aged slaked lime (calcium hydroxide) blended with crushed Carrara marble dust. It cures through natural carbonation—absorbing ambient carbon dioxide from the air to revert back to solid limestone rock.$art$))),
        jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', $art$This crystalline carbonation creates a microscopic translucency where ambient light penetrates beneath the surface before scattering, imparting a luminous depth that conventional synthetic paints do not replicate through the same mechanism.$art$))),
        jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', $art$Furthermore, genuine lime plasters remain naturally alkaline (pH 12–13), making them inherently resistant to mold, bacteria, and electrostatic dust accumulation.$art$)))
      )
    ),
    $art$<p>The resurgence of tactile, monolithic wall finishes in luxury residences has created widespread confusion between authentic lime-based plasters and synthetic acrylic-based textured pastes.</p><p>Authentic Venetian Marmorino consists of aged slaked lime (calcium hydroxide) blended with crushed Carrara marble dust. It cures through natural carbonation—absorbing ambient carbon dioxide from the air to revert back to solid limestone rock.</p><p>This crystalline carbonation creates a microscopic translucency where ambient light penetrates beneath the surface before scattering, imparting a luminous depth that conventional synthetic paints do not replicate through the same mechanism.</p><p>Furthermore, genuine lime plasters remain naturally alkaline (pH 12–13), making them inherently resistant to mold, bacteria, and electrostatic dust accumulation.</p>$art$,
    'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=80',
    'Interior architectural living space featuring monolithic neutral wall finishes',
    'review',
    FALSE,
    8,
    'Strovyn Painting Co.',
    'Finishing Techniques',
    NULL,
    '2026-01-14T00:00:00Z',
    '2026-01-14T00:00:00Z'
  ),

  -- Article 4 -> draft (unpublished; requires client approval & slug remediation)
  (
    'lead-safe-conservation-protocols-heritage-homes',
    'Modern Surface Preparation for Residential Painting',
    'Surface Preparation',
    $art$The fundamental stages of residential surface preparation—from cleaning and substrate repairs to priming, sanding and safe handling of older coatings.$art$,
    $art$The longevity and visual consistency of any residential paint finish depend fundamentally on thorough surface preparation. Before any topcoat is applied, existing surfaces must be meticulously cleaned to remove dust, grease, contaminants and loose or flaking material that compromise adhesion.

Substrate defects such as minor indentations, hairline plaster cracks, gaps around trim work and surface unevenness require systematic filling and leveling. Once compounds have fully cured, controlled sanding creates a uniform mechanical profile, ensuring subsequent coatings lay flat and adhere reliably.

Applying an appropriate primer or sealer is the crucial bridging step. A high-quality primer stabilizes porous substrates, prevents uneven suction across patched zones, and establishes an optimal base for uniform color and sheen development across all living spaces.

Safety Note on Older Structures: When working in homes constructed prior to 1970, older coating layers may contain hazardous lead-based pigments or other regulated compounds. Suspected hazardous coatings must never be dry-sanded, dry-scraped, or heated with open torches or uncontrolled heat guns. Where older or deteriorating coatings are suspected of containing hazardous materials, work should cease until surfaces are formally tested and addressed by appropriately licensed and qualified environmental remediation professionals.$art$,
    jsonb_build_object(
      'type', 'doc',
      'content', jsonb_build_array(
        jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', $art$The longevity and visual consistency of any residential paint finish depend fundamentally on thorough surface preparation. Before any topcoat is applied, existing surfaces must be meticulously cleaned to remove dust, grease, contaminants and loose or flaking material that compromise adhesion.$art$))),
        jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', $art$Substrate defects such as minor indentations, hairline plaster cracks, gaps around trim work and surface unevenness require systematic filling and leveling. Once compounds have fully cured, controlled sanding creates a uniform mechanical profile, ensuring subsequent coatings lay flat and adhere reliably.$art$))),
        jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', $art$Applying an appropriate primer or sealer is the crucial bridging step. A high-quality primer stabilizes porous substrates, prevents uneven suction across patched zones, and establishes an optimal base for uniform color and sheen development across all living spaces.$art$))),
        jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', $art$Safety Note on Older Structures: When working in homes constructed prior to 1970, older coating layers may contain hazardous lead-based pigments or other regulated compounds. Suspected hazardous coatings must never be dry-sanded, dry-scraped, or heated with open torches or uncontrolled heat guns. Where older or deteriorating coatings are suspected of containing hazardous materials, work should cease until surfaces are formally tested and addressed by appropriately licensed and qualified environmental remediation professionals.$art$)))
      )
    ),
    $art$<p>The longevity and visual consistency of any residential paint finish depend fundamentally on thorough surface preparation. Before any topcoat is applied, existing surfaces must be meticulously cleaned to remove dust, grease, contaminants and loose or flaking material that compromise adhesion.</p><p>Substrate defects such as minor indentations, hairline plaster cracks, gaps around trim work and surface unevenness require systematic filling and leveling. Once compounds have fully cured, controlled sanding creates a uniform mechanical profile, ensuring subsequent coatings lay flat and adhere reliably.</p><p>Applying an appropriate primer or sealer is the crucial bridging step. A high-quality primer stabilizes porous substrates, prevents uneven suction across patched zones, and establishes an optimal base for uniform color and sheen development across all living spaces.</p><p>Safety Note on Older Structures: When working in homes constructed prior to 1970, older coating layers may contain hazardous lead-based pigments or other regulated compounds. Suspected hazardous coatings must never be dry-sanded, dry-scraped, or heated with open torches or uncontrolled heat guns. Where older or deteriorating coatings are suspected of containing hazardous materials, work should cease until surfaces are formally tested and addressed by appropriately licensed and qualified environmental remediation professionals.</p>$art$,
    '/images/painted-texture-detail.jpg',
    'Close-up surface texture showing prepared and coated architectural finish',
    'draft',
    FALSE,
    6,
    'Strovyn Painting Co.',
    'Residential Surface Preparation',
    NULL,
    '2025-11-20T00:00:00Z',
    '2025-11-20T00:00:00Z'
  ),

  -- Article 5 -> published
  (
    'architectural-sheen-selection-raking-light',
    'Architectural Sheen Selection Across High-Raking Daylight Planes',
    'Painting Techniques',
    $art$How gloss levels from dead-flat mineral coats to eggshell interact with ceiling planes and large glazing elevations across South Australian homes.$art$,
    $art$Selecting an architectural sheen level involves more than aesthetic preference; it governs how light scatters across broad, unshadowed ceiling planes and double-height living areas.

Dead-flat and velvet-matte formulations (1–3% specular gloss) diffuse direct solar radiation omnidirectionally. This optical dispersion significantly reduces the visibility of minor planar substrate variations under critical raking light.

Higher sheen levels—including eggshell and satin—provide superior mechanical washability and burnish resistance, making them ideal for high-traffic corridors, service areas, and architectural joinery.

Balancing light absorption with maintenance durability requires specifying zoned finish schedules that align with room orientation and diurnal sunlight patterns.$art$,
    jsonb_build_object(
      'type', 'doc',
      'content', jsonb_build_array(
        jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', $art$Selecting an architectural sheen level involves more than aesthetic preference; it governs how light scatters across broad, unshadowed ceiling planes and double-height living areas.$art$))),
        jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', $art$Dead-flat and velvet-matte formulations (1–3% specular gloss) diffuse direct solar radiation omnidirectionally. This optical dispersion significantly reduces the visibility of minor planar substrate variations under critical raking light.$art$))),
        jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', $art$Higher sheen levels—including eggshell and satin—provide superior mechanical washability and burnish resistance, making them ideal for high-traffic corridors, service areas, and architectural joinery.$art$))),
        jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', $art$Balancing light absorption with maintenance durability requires specifying zoned finish schedules that align with room orientation and diurnal sunlight patterns.$art$)))
      )
    ),
    $art$<p>Selecting an architectural sheen level involves more than aesthetic preference; it governs how light scatters across broad, unshadowed ceiling planes and double-height living areas.</p><p>Dead-flat and velvet-matte formulations (1–3% specular gloss) diffuse direct solar radiation omnidirectionally. This optical dispersion significantly reduces the visibility of minor planar substrate variations under critical raking light.</p><p>Higher sheen levels—including eggshell and satin—provide superior mechanical washability and burnish resistance, making them ideal for high-traffic corridors, service areas, and architectural joinery.</p><p>Balancing light absorption with maintenance durability requires specifying zoned finish schedules that align with room orientation and diurnal sunlight patterns.</p>$art$,
    'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80',
    'Sunlit architectural living room illustrating matte wall and ceiling light diffusion',
    'published',
    FALSE,
    5,
    'Strovyn Painting Co.',
    'Finishing Techniques',
    '2025-10-15T00:00:00Z',
    '2025-10-15T00:00:00Z',
    '2025-10-15T00:00:00Z'
  ),

  -- Article 6 -> review
  (
    'low-voc-waterborne-enamels-residential-joinery',
    'Waterborne Polyurethane Enamels for Interior Architectural Joinery',
    'Paint Chemistry',
    $art$Evaluating cross-linking durability, blocking resistance, and ambient air quality across modern waterborne trim finishes.$art$,
    $art$Traditional solvent-borne alkyds historically dominated architectural trim and door specifications due to their extended open time and natural self-leveling flow.

Modern waterborne polyurethane acrylic dispersions achieve comparable film build and leveling through engineered cross-linking resins, eliminating lingering solvent off-gassing and yellowing over time.

Advanced waterborne formulations achieve full block resistance within 24 to 48 hours, preventing painted door seals and window reveals from sticking in Adelaide’s summer temperature extremes.

Specifying low-VOC waterborne enamels ensures compliant indoor air quality while delivering a hard-wearing, scrub-resistant finish on millwork, architraves, and skirtings.$art$,
    jsonb_build_object(
      'type', 'doc',
      'content', jsonb_build_array(
        jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', $art$Traditional solvent-borne alkyds historically dominated architectural trim and door specifications due to their extended open time and natural self-leveling flow.$art$))),
        jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', $art$Modern waterborne polyurethane acrylic dispersions achieve comparable film build and leveling through engineered cross-linking resins, eliminating lingering solvent off-gassing and yellowing over time.$art$))),
        jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', $art$Advanced waterborne formulations achieve full block resistance within 24 to 48 hours, preventing painted door seals and window reveals from sticking in Adelaide’s summer temperature extremes.$art$))),
        jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', $art$Specifying low-VOC waterborne enamels ensures compliant indoor air quality while delivering a hard-wearing, scrub-resistant finish on millwork, architraves, and skirtings.$art$)))
      )
    ),
    $art$<p>Traditional solvent-borne alkyds historically dominated architectural trim and door specifications due to their extended open time and natural self-leveling flow.</p><p>Modern waterborne polyurethane acrylic dispersions achieve comparable film build and leveling through engineered cross-linking resins, eliminating lingering solvent off-gassing and yellowing over time.</p><p>Advanced waterborne formulations achieve full block resistance within 24 to 48 hours, preventing painted door seals and window reveals from sticking in Adelaide’s summer temperature extremes.</p><p>Specifying low-VOC waterborne enamels ensures compliant indoor air quality while delivering a hard-wearing, scrub-resistant finish on millwork, architraves, and skirtings.</p>$art$,
    'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1200&q=80',
    'Interior architectural joinery and painted cabinetry in a minimalist residence',
    'review',
    FALSE,
    5,
    'Strovyn Painting Co.',
    'Paint Chemistry',
    NULL,
    '2025-09-28T00:00:00Z',
    '2025-09-28T00:00:00Z'
  ),

  -- Article 7 -> published
  (
    'moisture-equilibration-masonry-coatings',
    'Substrate Moisture Equilibration in Architectural Masonry Painting',
    'Surface Preparation',
    $art$The diagnostic protocols for evaluating substrate relative humidity and capillary rise before applying exterior coatings.$art$,
    $art$Applying barrier paint films over masonry that retains elevated internal moisture is the most common cause of premature coating delamination, blistering, and efflorescence.

Moisture equilibrium must be confirmed prior to coating. Measuring substrate moisture content using electrical impedance and pin-probe diagnostics establishes whether the wall envelope is ready for coating application.

Where masonry remains exposed to ground damp or seasonal vapor drive, breathable micro-porous or mineral silicate systems provide an escape path for moisture vapor, preventing hydraulic pressure from lifting the paint film.

A thorough moisture diagnostic sequence protects both the exterior coating investment and the underlying structural masonry substrate.$art$,
    jsonb_build_object(
      'type', 'doc',
      'content', jsonb_build_array(
        jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', $art$Applying barrier paint films over masonry that retains elevated internal moisture is the most common cause of premature coating delamination, blistering, and efflorescence.$art$))),
        jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', $art$Moisture equilibrium must be confirmed prior to coating. Measuring substrate moisture content using electrical impedance and pin-probe diagnostics establishes whether the wall envelope is ready for coating application.$art$))),
        jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', $art$Where masonry remains exposed to ground damp or seasonal vapor drive, breathable micro-porous or mineral silicate systems provide an escape path for moisture vapor, preventing hydraulic pressure from lifting the paint film.$art$))),
        jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', $art$A thorough moisture diagnostic sequence protects both the exterior coating investment and the underlying structural masonry substrate.$art$)))
      )
    ),
    $art$<p>Applying barrier paint films over masonry that retains elevated internal moisture is the most common cause of premature coating delamination, blistering, and efflorescence.</p><p>Moisture equilibrium must be confirmed prior to coating. Measuring substrate moisture content using electrical impedance and pin-probe diagnostics establishes whether the wall envelope is ready for coating application.</p><p>Where masonry remains exposed to ground damp or seasonal vapor drive, breathable micro-porous or mineral silicate systems provide an escape path for moisture vapor, preventing hydraulic pressure from lifting the paint film.</p><p>A thorough moisture diagnostic sequence protects both the exterior coating investment and the underlying structural masonry substrate.</p>$art$,
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
    'Exterior architectural masonry facade protected with breathable exterior coating system',
    'published',
    FALSE,
    6,
    'Strovyn Painting Co.',
    'Surface Preparation',
    '2025-08-14T00:00:00Z',
    '2025-08-14T00:00:00Z',
    '2025-08-14T00:00:00Z'
  )
ON CONFLICT (slug) DO NOTHING;

-- Record idempotent initial migration audit entries only once per seeded slug.
INSERT INTO public.article_audit_log (
  article_id,
  actor_type,
  actor_role,
  action,
  from_status,
  to_status,
  note,
  metadata
)
SELECT
  a.id,
  'migration',
  'system',
  'seed_migration',
  NULL,
  a.status,
  'Initial CMS-1 tiered seed from articlesData.ts',
  jsonb_build_object(
    'migration', '003_editorial_cms',
    'legacy_static_date', to_char(a.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
  )
FROM public.articles a
WHERE a.slug IN (
  'achieving-as-nzs-2311-level-5-surface-standards',
  'chemistry-of-potassium-silicate-mineral-coatings',
  'authentic-venetian-plaster-vs-synthetic-render',
  'lead-safe-conservation-protocols-heritage-homes',
  'architectural-sheen-selection-raking-light',
  'low-voc-waterborne-enamels-residential-joinery',
  'moisture-equilibration-masonry-coatings'
)
AND NOT EXISTS (
  SELECT 1
  FROM public.article_audit_log log_row
  WHERE log_row.article_id = a.id
    AND log_row.action = 'seed_migration'
);
