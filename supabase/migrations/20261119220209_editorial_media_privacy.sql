-- ============================================================================
-- STROVYN EDITORIAL CMS — MIGRATION 006 (PRIVATE-BY-DEFAULT EDITORIAL MEDIA)
-- Additive migration preserving 001, 002, 003, 004, and 005 unchanged.
--
-- Features:
--   1. Converts `editorial-media` Storage bucket to PRIVATE (`public = FALSE`)
--      so unauthenticated callers can never retrieve unpublished draft assets.
--   2. Creates dedicated public delivery bucket `editorial-media-public`
--      (`public = TRUE`) solely for assets promoted upon article publication,
--      still without permissive folder listing policies on `storage.objects`.
--      Leaves `customer-documents` completely isolated and untouched.
--   3. Extends `public.editorial_media_assets` with explicit visibility,
--      promotion tracking (`public_bucket_id`, `public_storage_path`,
--      `promoted_at`, `promoted_by`), recoverable deletion workflow state
--      (`delete_state` = 'active'|'pending_delete'|'deleted'|'delete_failed'),
--      and nullable `public_url` (NULL while private).
--   4. Expands `public.editorial_media_audit_log` actions to record promotion
--      and failure events without weakening append-only immutability.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Extend `public.editorial_media_assets` for Private Staging + Promotion
-- ----------------------------------------------------------------------------
ALTER TABLE public.editorial_media_assets
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS public_bucket_id TEXT,
  ADD COLUMN IF NOT EXISTS public_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS promoted_by UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delete_state TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS delete_error TEXT;

-- Relax NOT NULL on `public_url` so private assets never store fake public URLs
ALTER TABLE public.editorial_media_assets
  ALTER COLUMN public_url DROP NOT NULL;

-- Drop old 005 inline constraints cleanly before re-creating updated checks
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
        pg_get_constraintdef(c.oid) ILIKE '%bucket_id%'
        OR pg_get_constraintdef(c.oid) ILIKE '%public_url%'
        OR pg_get_constraintdef(c.oid) ILIKE '%visibility%'
        OR pg_get_constraintdef(c.oid) ILIKE '%delete_state%'
        OR pg_get_constraintdef(c.oid) ILIKE '%public_storage_path%'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.editorial_media_assets DROP CONSTRAINT %I', v_con.conname);
  END LOOP;
END;
$$;

-- Backfill any pre-existing unpromoted rows cleanly before applying invariants
UPDATE public.editorial_media_assets
SET
  visibility = 'private',
  public_url = NULL,
  public_bucket_id = NULL,
  public_storage_path = NULL
WHERE public_storage_path IS NULL;

UPDATE public.editorial_media_assets
SET delete_state = 'deleted'
WHERE deleted_at IS NOT NULL AND delete_state = 'active';

ALTER TABLE public.editorial_media_assets
  ADD CONSTRAINT editorial_media_assets_bucket_check
    CHECK (bucket_id IN ('editorial-media', 'editorial-media-public')),
  ADD CONSTRAINT editorial_media_assets_visibility_check
    CHECK (visibility IN ('private', 'public')),
  ADD CONSTRAINT editorial_media_assets_public_bucket_check
    CHECK (public_bucket_id IS NULL OR public_bucket_id = 'editorial-media-public'),
  ADD CONSTRAINT editorial_media_assets_public_path_check
    CHECK (
      public_storage_path IS NULL OR
      (LENGTH(TRIM(public_storage_path)) > 0 AND public_storage_path NOT LIKE '%..%')
    ),
  ADD CONSTRAINT editorial_media_assets_visibility_invariant_check
    CHECK (
      (visibility = 'private' AND public_url IS NULL AND public_bucket_id IS NULL AND public_storage_path IS NULL)
      OR
      (visibility = 'public' AND public_url IS NOT NULL AND LENGTH(TRIM(public_url)) > 0 AND public_bucket_id = 'editorial-media-public' AND public_storage_path IS NOT NULL)
    ),
  ADD CONSTRAINT editorial_media_assets_delete_state_check
    CHECK (delete_state IN ('active', 'pending_delete', 'deleted', 'delete_failed'));

CREATE INDEX IF NOT EXISTS editorial_media_assets_visibility_idx
  ON public.editorial_media_assets (visibility, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS editorial_media_assets_delete_state_idx
  ON public.editorial_media_assets (delete_state, updated_at DESC)
  WHERE delete_state IN ('pending_delete', 'delete_failed');

-- ----------------------------------------------------------------------------
-- 2. Extend `public.editorial_media_audit_log` Action Allowlist
-- ----------------------------------------------------------------------------
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
      AND t.relname = 'editorial_media_audit_log'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%action%'
  LOOP
    EXECUTE format('ALTER TABLE public.editorial_media_audit_log DROP CONSTRAINT %I', v_con.conname);
  END LOOP;
END;
$$;

ALTER TABLE public.editorial_media_audit_log
  ADD CONSTRAINT editorial_media_audit_log_action_check
    CHECK (
      action IN (
        'media_upload',
        'media_attach',
        'media_detach',
        'media_promote',
        'media_promote_failed',
        'media_delete',
        'media_delete_failed'
      )
    );

-- Keep PUBLIC, anon, authenticated strictly locked out; grant service_role DELETE
-- solely for compensating cleanup of aborted pre-audit uploads on `editorial_media_assets`.
REVOKE ALL ON TABLE public.editorial_media_assets FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.editorial_media_audit_log FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.editorial_media_assets TO service_role;
    GRANT SELECT, INSERT ON TABLE public.editorial_media_audit_log TO service_role;
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Conditional Supabase Storage Privacy Enforcement
--    - `editorial-media` -> `public = FALSE` (private draft staging bucket)
--    - `editorial-media-public` -> `public = TRUE` (published delivery only)
--    - Zero anonymous/authenticated `storage.objects` listing or read policies
--    - `customer-documents` remains untouched
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
      FALSE,
      5242880,
      ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
    )
    ON CONFLICT (id) DO UPDATE
      SET public = FALSE,
          file_size_limit = EXCLUDED.file_size_limit,
          allowed_mime_types = EXCLUDED.allowed_mime_types;

    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'editorial-media-public',
      'editorial-media-public',
      TRUE,
      5242880,
      ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
    )
    ON CONFLICT (id) DO UPDATE
      SET public = TRUE,
          file_size_limit = EXCLUDED.file_size_limit,
          allowed_mime_types = EXCLUDED.allowed_mime_types;
  END IF;
END;
$$;
