-- ============================================================================
-- STROVYN EDITORIAL CMS — MIGRATION 005 (CMS-2 EDITORIAL MEDIA STORAGE)
-- Additive migration preserving 001, 002, 003, and 004 unchanged.
--
-- Features:
--   1. Metadata registry `public.editorial_media_assets` restricted strictly to
--      `bucket_id = 'editorial-media'` (never `customer-documents`).
--   2. Append-only audit log `public.editorial_media_audit_log` with UPDATE,
--      DELETE, and TRUNCATE immutability guards.
--   3. Least-privilege SQL REVOKE/GRANT & RLS preventing public listing of
--      draft/unpublished media metadata.
--   4. Conditional Supabase Storage bucket (`editorial-media`) creation &
--      least-privilege `storage.objects` isolation (only runs when Supabase
--      `storage.buckets` exists; leaves `customer-documents` untouched).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Editorial Media Assets Registry (`public.editorial_media_assets`)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.editorial_media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id TEXT NOT NULL DEFAULT 'editorial-media'
    CHECK (bucket_id = 'editorial-media'),
  storage_path TEXT UNIQUE NOT NULL
    CHECK (LENGTH(TRIM(storage_path)) > 0 AND storage_path NOT LIKE '%..%'),
  public_url TEXT NOT NULL
    CHECK (LENGTH(TRIM(public_url)) > 0),
  mime_type TEXT NOT NULL
    CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  byte_size INT NOT NULL
    CHECK (byte_size > 0 AND byte_size <= 5242880),
  width INT NOT NULL
    CHECK (width >= 16 AND width <= 8192),
  height INT NOT NULL
    CHECK (height >= 16 AND height <= 8192),
  alt_text TEXT NOT NULL
    CHECK (LENGTH(TRIM(alt_text)) >= 3 AND LENGTH(TRIM(alt_text)) <= 300),
  article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,
  uploaded_by UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS editorial_media_assets_active_idx
  ON public.editorial_media_assets (created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS editorial_media_assets_article_idx
  ON public.editorial_media_assets (article_id, created_at DESC)
  WHERE article_id IS NOT NULL AND deleted_at IS NULL;

DROP TRIGGER IF EXISTS editorial_media_assets_touch_updated_at ON public.editorial_media_assets;
CREATE TRIGGER editorial_media_assets_touch_updated_at
  BEFORE UPDATE ON public.editorial_media_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.cms_touch_updated_at();

ALTER TABLE public.editorial_media_assets ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 2. Immutable Editorial Media Audit Log (`public.editorial_media_audit_log`)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.editorial_media_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_seq BIGSERIAL,
  asset_id UUID NOT NULL REFERENCES public.editorial_media_assets(id) ON DELETE RESTRICT,
  actor_staff_id UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
  actor_email TEXT,
  actor_role TEXT
    CHECK (actor_role IS NULL OR actor_role IN ('editor', 'publisher', 'admin', 'system')),
  action TEXT NOT NULL
    CHECK (action IN ('media_upload', 'media_attach', 'media_detach', 'media_delete')),
  storage_path TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS editorial_media_audit_log_asset_idx
  ON public.editorial_media_audit_log (asset_id, created_at DESC, event_seq DESC);

CREATE OR REPLACE FUNCTION public.prevent_editorial_media_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'editorial_media_audit_log is append-only; UPDATE, DELETE, and TRUNCATE are prohibited';
END;
$$;

DROP TRIGGER IF EXISTS editorial_media_audit_immutable_guard ON public.editorial_media_audit_log;
CREATE TRIGGER editorial_media_audit_immutable_guard
  BEFORE UPDATE OR DELETE ON public.editorial_media_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_editorial_media_audit_mutation();

DROP TRIGGER IF EXISTS editorial_media_audit_truncate_guard ON public.editorial_media_audit_log;
CREATE TRIGGER editorial_media_audit_truncate_guard
  BEFORE TRUNCATE ON public.editorial_media_audit_log
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.prevent_editorial_media_audit_mutation();

ALTER TABLE public.editorial_media_audit_log ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 3. Least-Privilege SQL Revocations & Service-Role Grants
-- ----------------------------------------------------------------------------
-- Neither `anon` nor `authenticated` may query `editorial_media_assets`
-- or `editorial_media_audit_log` directly (prevents enumeration of unpublished
-- draft media metadata/URLs). All staff media operations go through verified
-- server endpoints using `service_role`.
REVOKE ALL ON TABLE public.editorial_media_assets FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.editorial_media_audit_log FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_editorial_media_audit_mutation() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE public.editorial_media_assets TO service_role;
    GRANT SELECT, INSERT ON TABLE public.editorial_media_audit_log TO service_role;
    GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Conditional Supabase Storage Bucket (`editorial-media`) Setup
--    Never modifies `customer-documents`. Creates NO public `storage.objects`
--    SELECT policy so public folder enumeration via PostgREST Storage API is
--    blocked, while Supabase CDN serves known unguessable object URLs directly.
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
      'editorial-media',
      'editorial-media',
      TRUE,
      5242880,
      ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
    )
    ON CONFLICT (id) DO UPDATE
      SET public = EXCLUDED.public,
          file_size_limit = EXCLUDED.file_size_limit,
          allowed_mime_types = EXCLUDED.allowed_mime_types;
  END IF;
END;
$$;
