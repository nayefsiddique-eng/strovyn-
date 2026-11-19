-- ============================================================================
-- STROVYN EDITORIAL CMS — MIGRATION 007 (PUBLICATION-GATED MEDIA DELIVERY)
-- Additive migration preserving 001 through 006 unchanged.
--
-- Features:
--   1. Retires `editorial-media-public` bucket exposure (`public = FALSE` if
--      present; retains only `editorial-media` as permanently private).
--      Never modifies `customer-documents`.
--   2. Reverts any previously promoted rows in `editorial_media_assets` back
--      to `visibility = 'private'` (`public_url = NULL`) and enforces private
--      single-bucket storage.
--   3. Adds indexed authoritative reference table `public.article_media_references`
--      (`featured_image`, `og_image`, `content_json` image nodes ONLY — never
--      arbitrary strings in text/HTML) maintained automatically by DB trigger
--      `cms_sync_article_media_references()`.
--   4. Adds narrowly-scoped, indexed `SECURITY DEFINER` resolver
--      `public.cms_resolve_public_editorial_media(UUID)` callable strictly by
--      `service_role` to gate public HTTP image delivery exclusively on live
--      published article state (`status = 'published'`, `published_at <= NOW()`).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Retire `editorial-media-public` Bucket & Keep `editorial-media` Private
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'storage'
      AND table_name = 'buckets'
  ) THEN
    -- Keep editorial-media strictly private
    UPDATE storage.buckets
    SET public = FALSE
    WHERE id = 'editorial-media';

    -- Disable public access on retired editorial-media-public bucket if it exists
    UPDATE storage.buckets
    SET public = FALSE
    WHERE id = 'editorial-media-public';
  END IF;
END;
$$;

-- Normalize any promoted metadata rows back to strict private invariant (`006`)
UPDATE public.editorial_media_assets
SET
  bucket_id = 'editorial-media',
  visibility = 'private',
  public_url = NULL,
  public_bucket_id = NULL,
  public_storage_path = NULL,
  promoted_at = NULL,
  promoted_by = NULL
WHERE bucket_id <> 'editorial-media'
   OR visibility <> 'private'
   OR public_url IS NOT NULL
   OR public_bucket_id IS NOT NULL
   OR public_storage_path IS NOT NULL;

-- Drop 006 bucket constraint if it allowed editorial-media-public and restrict cleanly
DO $$
DECLARE
  v_con RECORD;
BEGIN
  FOR v_con IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'editorial_media_assets'
      AND c.contype = 'c'
      AND (
        c.conname = 'editorial_media_assets_bucket_check'
        OR c.conname = 'editorial_media_assets_visibility_check'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.editorial_media_assets DROP CONSTRAINT %I', v_con.conname);
  END LOOP;
END;
$$;

ALTER TABLE public.editorial_media_assets
  ADD CONSTRAINT editorial_media_assets_bucket_check
    CHECK (bucket_id = 'editorial-media'),
  ADD CONSTRAINT editorial_media_assets_visibility_check
    CHECK (visibility = 'private');

-- ----------------------------------------------------------------------------
-- 2. Authoritative Indexed Article <-> Media Asset References Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.article_media_references (
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.editorial_media_assets(id) ON DELETE RESTRICT,
  reference_source TEXT NOT NULL
    CHECK (reference_source IN ('featured_image', 'og_image', 'content_json')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (article_id, asset_id, reference_source)
);

CREATE INDEX IF NOT EXISTS article_media_references_asset_idx
  ON public.article_media_references (asset_id, article_id);

ALTER TABLE public.article_media_references ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.article_media_references FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT, DELETE ON TABLE public.article_media_references TO service_role;
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Trigger-Maintained Reference Extraction (Authoritative Fields Only)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cms_extract_editorial_media_uuid(p_url TEXT)
RETURNS UUID
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_match TEXT[];
BEGIN
  IF p_url IS NULL THEN
    RETURN NULL;
  END IF;

  v_match := regexp_match(
    TRIM(p_url),
    '^/api/(?:editorial-media|admin/insights/media)/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$',
    'i'
  );
  IF v_match IS NULL OR v_match[1] IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN LOWER(v_match[1])::uuid;
END;
$$;

CREATE OR REPLACE FUNCTION public.cms_rebuild_article_media_references(
  p_article_id UUID,
  p_featured_url TEXT,
  p_og_url TEXT,
  p_content_json JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_feat_id UUID;
  v_og_id UUID;
BEGIN
  DELETE FROM public.article_media_references
  WHERE article_id = p_article_id;

  v_feat_id := public.cms_extract_editorial_media_uuid(p_featured_url);
  IF v_feat_id IS NOT NULL THEN
    INSERT INTO public.article_media_references (article_id, asset_id, reference_source)
    SELECT p_article_id, e.id, 'featured_image'
    FROM public.editorial_media_assets e
    WHERE e.id = v_feat_id
    ON CONFLICT DO NOTHING;
  END IF;

  v_og_id := public.cms_extract_editorial_media_uuid(p_og_url);
  IF v_og_id IS NOT NULL THEN
    INSERT INTO public.article_media_references (article_id, asset_id, reference_source)
    SELECT p_article_id, e.id, 'og_image'
    FROM public.editorial_media_assets e
    WHERE e.id = v_og_id
    ON CONFLICT DO NOTHING;
  END IF;

  IF p_content_json IS NOT NULL THEN
    WITH RECURSIVE nodes(elem) AS (
      SELECT p_content_json
      UNION ALL
      SELECT child
      FROM nodes,
      LATERAL (
        SELECT elem->'content' AS arr
        WHERE jsonb_typeof(elem) = 'object'
          AND jsonb_typeof(elem->'content') = 'array'
      ) c,
      LATERAL jsonb_array_elements(c.arr) AS child
    ),
    extracted_ids AS (
      SELECT DISTINCT public.cms_extract_editorial_media_uuid(elem->'attrs'->>'src') AS asset_id
      FROM nodes
      WHERE jsonb_typeof(elem) = 'object'
        AND elem->>'type' = 'image'
        AND jsonb_typeof(elem->'attrs') = 'object'
        AND elem->'attrs'->>'src' IS NOT NULL
    )
    INSERT INTO public.article_media_references (article_id, asset_id, reference_source)
    SELECT p_article_id, e.id, 'content_json'
    FROM extracted_ids x
    JOIN public.editorial_media_assets e ON e.id = x.asset_id
    WHERE x.asset_id IS NOT NULL
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.cms_sync_article_media_references_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'INSERT'
     OR OLD.featured_image_url IS DISTINCT FROM NEW.featured_image_url
     OR OLD.og_image_url IS DISTINCT FROM NEW.og_image_url
     OR OLD.content_json IS DISTINCT FROM NEW.content_json THEN
    PERFORM public.cms_rebuild_article_media_references(
      NEW.id,
      NEW.featured_image_url,
      NEW.og_image_url,
      NEW.content_json
    );
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS articles_sync_media_references ON public.articles;
CREATE TRIGGER articles_sync_media_references
  AFTER INSERT OR UPDATE ON public.articles
  FOR EACH ROW
  EXECUTE FUNCTION public.cms_sync_article_media_references_trigger();

-- Backfill existing articles cleanly (idempotent)
DO $$
DECLARE
  v_art RECORD;
BEGIN
  FOR v_art IN
    SELECT id, featured_image_url, og_image_url, content_json
    FROM public.articles
  LOOP
    PERFORM public.cms_rebuild_article_media_references(
      v_art.id,
      v_art.featured_image_url,
      v_art.og_image_url,
      v_art.content_json
    );
  END LOOP;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Narrowly-Scoped Publication-Gated Public Delivery Resolver RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cms_resolve_public_editorial_media(
  p_asset_id UUID
)
RETURNS TABLE (
  id UUID,
  storage_path TEXT,
  mime_type TEXT,
  byte_size INT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_asset_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.storage_path,
    a.mime_type,
    a.byte_size
  FROM public.editorial_media_assets a
  WHERE a.id = p_asset_id
    AND a.bucket_id = 'editorial-media'
    AND a.visibility = 'private'
    AND a.deleted_at IS NULL
    AND a.delete_state = 'active'
    AND EXISTS (
      SELECT 1
      FROM public.article_media_references r
      JOIN public.articles art ON art.id = r.article_id
      WHERE r.asset_id = a.id
        AND art.status = 'published'
        AND art.published_at IS NOT NULL
        AND art.published_at <= NOW()
    )
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.cms_extract_editorial_media_uuid(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cms_rebuild_article_media_references(UUID, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cms_sync_article_media_references_trigger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cms_resolve_public_editorial_media(UUID) FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.cms_resolve_public_editorial_media(UUID) TO service_role;
  END IF;
END;
$$;
