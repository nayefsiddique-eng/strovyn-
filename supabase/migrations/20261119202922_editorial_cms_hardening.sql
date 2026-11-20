-- ============================================================================
-- STROVYN EDITORIAL CMS — MIGRATION 004 (CMS-1.2 & CMS-1.4 HARDENING)
-- Additive migration preserving 001, 002, and 003 unchanged.
--
-- Addresses CMS-1.1 & CMS-1.3 audit findings:
--   - A-1: Mandatory `published_at` for published rows + removal of
--          `published_at IS NULL` public RLS exception (after legacy backfill).
--   - A-3 / CMS-1.4 Ph2: Audit snapshot columns (`previous_snapshot`,
--          `new_snapshot`), `reading_time` inclusion, editorial vs operational
--          retry separation, strict attribution without `OLD.updated_by`
--          misattribution, TRUNCATE guard, and automatic INSERT/UPDATE audit.
--   - A-4 / CMS-1.4 Ph4: Explicit `REVOKE`/`GRANT` privileges across tables &
--          functions, fixed `search_path` on all 003/004 functions, removal of
--          unnecessary `SECURITY DEFINER`, and strict `p_action` allowlist.
--   - A-6: Separate historical static date column (`legacy_static_date`) so
--          unpublished legacy rows retain history without faking `published_at`.
--   - Sec 6: Database-controlled workflow transition RPC
--            (`cms_transition_article_status`) + `BEFORE UPDATE` bypass guard.
--
-- Rollback considerations (manual reference ONLY — NOT executed automatically):
--   To revert strict enforcement on a non-production database if needed:
--     1. DROP TRIGGER IF EXISTS articles_enforce_workflow ON public.articles;
--     2. DROP TRIGGER IF EXISTS articles_audit_changes ON public.articles;
--     3. DROP TRIGGER IF EXISTS articles_prevent_hard_delete ON public.articles;
--     4. DROP TRIGGER IF EXISTS article_audit_log_truncate_guard ON public.article_audit_log;
--     5. DROP FUNCTION IF EXISTS public.cms_transition_article_status(UUID, TEXT, UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT);
--     6. Restore previous CHECK / RLS policies explicitly if relaxing rules.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Harden 003 helper functions with explicit safe `search_path` (Ph4)
--    Preserves `003_editorial_cms.sql` untouched while updating live definitions.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cms_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_article_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'article_audit_log is append-only; UPDATE and DELETE operations are prohibited';
END;
$$;

-- ----------------------------------------------------------------------------
-- 1. Historical static date metadata column & idempotent backfill (A-6)
-- ----------------------------------------------------------------------------
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS legacy_static_date TIMESTAMPTZ;

DO $$
BEGIN
  -- Keep unpublished seeded articles (#2, #3, #4, #6) at `published_at = NULL`;
  -- preserve their original static date strictly in `legacy_static_date`.
  UPDATE public.articles AS a
  SET legacy_static_date = v.legacy_ts
  FROM (
    VALUES
      ('achieving-as-nzs-2311-level-5-surface-standards', '2026-02-12T00:00:00Z'::timestamptz),
      ('chemistry-of-potassium-silicate-mineral-coatings', '2026-01-28T00:00:00Z'::timestamptz),
      ('authentic-venetian-plaster-vs-synthetic-render', '2026-01-14T00:00:00Z'::timestamptz),
      ('lead-safe-conservation-protocols-heritage-homes', '2025-11-20T00:00:00Z'::timestamptz),
      ('architectural-sheen-selection-raking-light', '2025-10-15T00:00:00Z'::timestamptz),
      ('low-voc-waterborne-enamels-residential-joinery', '2025-09-28T00:00:00Z'::timestamptz),
      ('moisture-equilibration-masonry-coatings', '2025-08-14T00:00:00Z'::timestamptz)
  ) AS v(slug, legacy_ts)
  WHERE a.slug = v.slug
    AND a.legacy_static_date IS NULL;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Publication date integrity backfill, constraint & hardened RLS (A-1)
-- ----------------------------------------------------------------------------
-- Backfill any pre-existing `status = 'published'` rows lacking `published_at`:
-- prefer `legacy_static_date`, then `created_at`, then `NOW()`.
UPDATE public.articles
SET published_at = COALESCE(published_at, legacy_static_date, created_at, NOW())
WHERE status = 'published'
  AND published_at IS NULL;

ALTER TABLE public.articles
  DROP CONSTRAINT IF EXISTS articles_published_requires_timestamp_check;

ALTER TABLE public.articles
  ADD CONSTRAINT articles_published_requires_timestamp_check
    CHECK (status <> 'published' OR published_at IS NOT NULL);

-- Remove `published_at IS NULL` fallback from public visibility policy.
DROP POLICY IF EXISTS "Public articles read" ON public.articles;
CREATE POLICY "Public articles read"
  ON public.articles
  FOR SELECT
  USING (
    status = 'published'
    AND published_at IS NOT NULL
    AND published_at <= NOW()
  );

-- ----------------------------------------------------------------------------
-- 3. Audit log schema completeness & snapshot helpers (A-3, Ph2)
-- ----------------------------------------------------------------------------
ALTER TABLE public.article_audit_log
  ADD COLUMN IF NOT EXISTS previous_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS new_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS event_seq BIGSERIAL;

ALTER TABLE public.article_audit_log
  DROP CONSTRAINT IF EXISTS article_audit_log_actor_type_check,
  DROP CONSTRAINT IF EXISTS article_audit_log_action_non_empty_check,
  DROP CONSTRAINT IF EXISTS article_audit_log_staff_attribution_check;

ALTER TABLE public.article_audit_log
  ADD CONSTRAINT article_audit_log_actor_type_check
    CHECK (actor_type IN ('staff', 'cron', 'migration', 'system')),
  ADD CONSTRAINT article_audit_log_action_non_empty_check
    CHECK (LENGTH(TRIM(action)) > 0 AND LENGTH(TRIM(action)) <= 64),
  ADD CONSTRAINT article_audit_log_staff_attribution_check
    CHECK (
      actor_type <> 'staff'
      OR actor_staff_id IS NOT NULL
      OR (actor_email IS NOT NULL AND LENGTH(TRIM(actor_email)) > 0)
    );

-- Prevent accidental TRUNCATE on append-only audit log
CREATE OR REPLACE FUNCTION public.prevent_article_audit_log_truncate()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'article_audit_log is append-only; TRUNCATE operations are prohibited';
END;
$$;

DROP TRIGGER IF EXISTS article_audit_log_truncate_guard ON public.article_audit_log;
CREATE TRIGGER article_audit_log_truncate_guard
  BEFORE TRUNCATE ON public.article_audit_log
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.prevent_article_audit_log_truncate();

-- Editorial-only snapshot serializer:
--   Includes editorial content, reading_time, SEO/image metadata, and lifecycle
--   accountability timestamps/actors (`status`, `scheduled_at`, `approved_at`,
--   `approved_by`, `published_at`, `published_by`, `archived_at`, `archived_by`,
--   `legacy_static_date`). Excludes operational retry columns (`publish_attempts`,
--   `last_publish_error`, `next_retry_at`) so automated cron retries are never
--   misclassified as human editorial changes.
CREATE OR REPLACE FUNCTION public.cms_article_editorial_snapshot(row_data public.articles)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
  SELECT jsonb_build_object(
    'id', row_data.id,
    'slug', row_data.slug,
    'title', row_data.title,
    'subtitle', row_data.subtitle,
    'category', row_data.category,
    'excerpt', row_data.excerpt,
    'content', row_data.content,
    'content_json', row_data.content_json,
    'content_html', row_data.content_html,
    'featured_image_url', row_data.featured_image_url,
    'featured_image_alt', row_data.featured_image_alt,
    'og_image_url', row_data.og_image_url,
    'seo_title', row_data.seo_title,
    'seo_description', row_data.seo_description,
    'is_featured', row_data.is_featured,
    'reading_time', row_data.reading_time,
    'author_name', row_data.author_name,
    'author_role', row_data.author_role,
    'status', row_data.status,
    'scheduled_at', row_data.scheduled_at,
    'approved_by', row_data.approved_by,
    'approved_at', row_data.approved_at,
    'published_by', row_data.published_by,
    'published_at', row_data.published_at,
    'archived_by', row_data.archived_by,
    'archived_at', row_data.archived_at,
    'legacy_static_date', row_data.legacy_static_date
  );
$$;

-- Full non-secret audit snapshot combining editorial/lifecycle state with
-- operational scheduling retry state (`publish_attempts`, `last_publish_error`,
-- `next_retry_at`) for forensic reconstruction.
CREATE OR REPLACE FUNCTION public.cms_article_audit_snapshot(row_data public.articles)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
  SELECT public.cms_article_editorial_snapshot(row_data) || jsonb_build_object(
    'publish_attempts', row_data.publish_attempts,
    'last_publish_error', row_data.last_publish_error,
    'next_retry_at', row_data.next_retry_at
  );
$$;

-- Append one baseline snapshot entry per article if it has no snapshot-bearing
-- audit entry yet (respects audit immutability — never UPDATEs existing logs).
INSERT INTO public.article_audit_log (
  article_id,
  actor_type,
  actor_role,
  action,
  from_status,
  to_status,
  note,
  new_snapshot,
  metadata
)
SELECT
  a.id,
  'migration',
  'system',
  'hardening_snapshot_baseline',
  NULL,
  a.status,
  'Initial CMS-1.2/1.4 editorial snapshot baseline',
  public.cms_article_audit_snapshot(a),
  jsonb_build_object(
    'migration', '004_editorial_cms_hardening',
    'legacy_static_date', to_char(COALESCE(a.legacy_static_date, a.created_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD')
  )
FROM public.articles a
WHERE NOT EXISTS (
  SELECT 1
  FROM public.article_audit_log log_row
  WHERE log_row.article_id = a.id
    AND log_row.new_snapshot IS NOT NULL
);

-- ----------------------------------------------------------------------------
-- 4. Automatic DB-level audit triggers & hard-delete protection (Ph2)
-- ----------------------------------------------------------------------------
-- PostgreSQL Trigger Attribution Limitation Note:
--   A row trigger receives OLD and NEW column values rather than SQL statement
--   intent or authenticated API identity. Therefore:
--   1. Operational-only updates (only `publish_attempts`, `last_publish_error`,
--      `next_retry_at` changing) are ALWAYS attributed as `actor_type = 'cron'`
--      (`actor_staff_id = NULL`), never falling back to `OLD.updated_by`.
--   2. Editorial updates never fall back to `OLD.updated_by` when
--      `NEW.updated_by IS NULL`; unattributed draft/review writes log as
--      `actor_type = 'system'`.
--   3. Protected-state edits (`approved`/`scheduled`/`published`/`archived`)
--      reject `NEW.updated_by IS NULL` via `cms_enforce_article_workflow()`.
CREATE OR REPLACE FUNCTION public.cms_audit_article_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_prev JSONB;
  v_next JSONB;
  v_ed_changed BOOLEAN;
  v_op_changed BOOLEAN;
  v_staff_id UUID;
  v_staff_email TEXT;
  v_staff_role TEXT;
  v_actor_type TEXT;
  v_action TEXT;
BEGIN
  -- Avoid duplicate rows when cms_transition_article_status() already logged
  -- the transition atomically in the same transaction.
  IF current_setting('strovyn.audit_captured', true) = 'true' THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_next := public.cms_article_audit_snapshot(NEW);

    IF NEW.created_by IS NOT NULL THEN
      SELECT id, email, role
      INTO v_staff_id, v_staff_email, v_staff_role
      FROM public.staff_users
      WHERE id = NEW.created_by;
    END IF;

    v_actor_type := CASE WHEN v_staff_id IS NOT NULL THEN 'staff' ELSE 'system' END;

    INSERT INTO public.article_audit_log (
      article_id,
      actor_staff_id,
      actor_type,
      actor_email,
      actor_role,
      action,
      from_status,
      to_status,
      note,
      previous_snapshot,
      new_snapshot,
      metadata
    ) VALUES (
      NEW.id,
      v_staff_id,
      v_actor_type,
      v_staff_email,
      COALESCE(v_staff_role, 'system'),
      'db_insert',
      NULL,
      NEW.status,
      'Captured by DB INSERT audit trigger',
      NULL,
      v_next,
      jsonb_build_object('source', 'trigger', 'change_scope', 'editorial')
    );
    RETURN NULL;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_ed_changed :=
      public.cms_article_editorial_snapshot(OLD) IS DISTINCT FROM public.cms_article_editorial_snapshot(NEW);
    v_op_changed := (
      OLD.publish_attempts IS DISTINCT FROM NEW.publish_attempts
      OR OLD.last_publish_error IS DISTINCT FROM NEW.last_publish_error
      OR OLD.next_retry_at IS DISTINCT FROM NEW.next_retry_at
    );

    -- Skip redundant audit entries when no meaningful editorial or operational
    -- retry field changed (e.g. touching only `updated_at` or a no-op update).
    IF NOT v_ed_changed AND NOT v_op_changed THEN
      RETURN NULL;
    END IF;

    v_prev := public.cms_article_audit_snapshot(OLD);
    v_next := public.cms_article_audit_snapshot(NEW);

    -- Pure operational retry metadata updates are strictly automated cron/system
    -- activity; NEVER attribute them to `OLD.updated_by` or `NEW.updated_by`.
    IF NOT v_ed_changed AND v_op_changed THEN
      INSERT INTO public.article_audit_log (
        article_id,
        actor_staff_id,
        actor_type,
        actor_email,
        actor_role,
        action,
        from_status,
        to_status,
        note,
        previous_snapshot,
        new_snapshot,
        metadata
      ) VALUES (
        NEW.id,
        NULL,
        'cron',
        NULL,
        'system',
        'cron_retry_recorded',
        OLD.status,
        NEW.status,
        'Operational retry metadata updated without editorial modification',
        v_prev,
        v_next,
        jsonb_build_object('source', 'trigger', 'change_scope', 'operational_retry')
      );
      RETURN NULL;
    END IF;

    -- Editorial update outside RPC: inspect NEW.updated_by ONLY (never fallback to OLD.updated_by).
    IF NEW.updated_by IS NOT NULL THEN
      SELECT id, email, role
      INTO v_staff_id, v_staff_email, v_staff_role
      FROM public.staff_users
      WHERE id = NEW.updated_by;
    END IF;

    v_actor_type := CASE WHEN v_staff_id IS NOT NULL THEN 'staff' ELSE 'system' END;
    v_action := CASE
      WHEN OLD.status IS DISTINCT FROM NEW.status THEN 'db_status_change'
      ELSE 'db_update'
    END;

    INSERT INTO public.article_audit_log (
      article_id,
      actor_staff_id,
      actor_type,
      actor_email,
      actor_role,
      action,
      from_status,
      to_status,
      note,
      previous_snapshot,
      new_snapshot,
      metadata
    ) VALUES (
      NEW.id,
      v_staff_id,
      v_actor_type,
      v_staff_email,
      COALESCE(v_staff_role, 'system'),
      v_action,
      OLD.status,
      NEW.status,
      CASE
        WHEN v_staff_id IS NOT NULL THEN 'Captured by DB UPDATE audit trigger'
        ELSE 'System editorial UPDATE (updated_by IS NULL)'
      END,
      v_prev,
      v_next,
      jsonb_build_object('source', 'trigger', 'change_scope', 'editorial')
    );
    RETURN NULL;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS articles_audit_changes ON public.articles;
CREATE TRIGGER articles_audit_changes
  AFTER INSERT OR UPDATE ON public.articles
  FOR EACH ROW
  EXECUTE FUNCTION public.cms_audit_article_changes();

-- Prevent destructive DELETE on articles (require 'archived' workflow status);
-- also complements `ON DELETE RESTRICT` on `article_audit_log.article_id`.
CREATE OR REPLACE FUNCTION public.cms_prevent_article_hard_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'Hard deletion of articles is prohibited; transition article status to archived instead';
END;
$$;

DROP TRIGGER IF EXISTS articles_prevent_hard_delete ON public.articles;
CREATE TRIGGER articles_prevent_hard_delete
  BEFORE DELETE ON public.articles
  FOR EACH ROW
  EXECUTE FUNCTION public.cms_prevent_article_hard_delete();

-- ----------------------------------------------------------------------------
-- 5. Database-controlled workflow enforcement & transition RPC (Ph2 & Ph4)
-- ----------------------------------------------------------------------------
-- Uses SECURITY INVOKER (default) rather than unnecessary SECURITY DEFINER:
-- only privileged callers (service_role / owner) can reach BEFORE UPDATE on articles.
CREATE OR REPLACE FUNCTION public.cms_enforce_article_workflow()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_edge_valid BOOLEAN := FALSE;
  v_ed_changed BOOLEAN := FALSE;
  v_actor_record RECORD;
BEGIN
  -- Status transitions must go through `cms_transition_article_status()`,
  -- preventing direct service-role or raw SQL workflow bypasses.
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF current_setting('strovyn.workflow_rpc', true) IS DISTINCT FROM 'cms_transition_article_status' THEN
      RAISE EXCEPTION 'Direct status updates on articles are prohibited; use cms_transition_article_status()';
    END IF;

    v_edge_valid := CASE
      WHEN OLD.status = 'draft' AND NEW.status = 'review' THEN TRUE
      WHEN OLD.status = 'review' AND NEW.status IN ('draft', 'approved') THEN TRUE
      WHEN OLD.status = 'approved' AND NEW.status IN ('draft', 'review', 'scheduled', 'published') THEN TRUE
      WHEN OLD.status = 'scheduled' AND NEW.status IN ('approved', 'draft', 'published') THEN TRUE
      WHEN OLD.status = 'published' AND NEW.status = 'archived' THEN TRUE
      WHEN OLD.status = 'archived' AND NEW.status = 'draft' THEN TRUE
      ELSE FALSE
    END;

    IF NOT v_edge_valid THEN
      RAISE EXCEPTION 'Workflow transition % -> % is prohibited by database policy', OLD.status, NEW.status;
    END IF;

    RETURN NEW;
  END IF;

  -- Status-preserving UPDATE: distinguish editorial mutations from pure
  -- operational retry metadata updates (`publish_attempts`, `last_publish_error`, `next_retry_at`).
  v_ed_changed :=
    public.cms_article_editorial_snapshot(OLD) IS DISTINCT FROM public.cms_article_editorial_snapshot(NEW);

  IF v_ed_changed THEN
    -- Protected statuses (`approved`, `scheduled`, `published`, `archived`)
    -- MUST NOT allow unattributed `updated_by = NULL` editorial mutations.
    IF OLD.status IN ('approved', 'scheduled', 'published', 'archived') THEN
      IF NEW.updated_by IS NULL THEN
        RAISE EXCEPTION 'Protected editorial updates in % status require an active publisher or admin updated_by actor', OLD.status;
      END IF;

      SELECT id, role, is_active
      INTO v_actor_record
      FROM public.staff_users
      WHERE id = NEW.updated_by;

      IF NOT FOUND OR v_actor_record.is_active IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'Inactive or unknown staff actor cannot modify article in % status', OLD.status;
      END IF;

      IF v_actor_record.role NOT IN ('publisher', 'admin') THEN
        RAISE EXCEPTION 'Role % cannot modify articles in % status', v_actor_record.role, OLD.status;
      END IF;
    ELSIF NEW.updated_by IS NOT NULL THEN
      -- Draft / review edits attributed to a staff member must reference an active staff record.
      SELECT id, role, is_active
      INTO v_actor_record
      FROM public.staff_users
      WHERE id = NEW.updated_by;

      IF NOT FOUND OR v_actor_record.is_active IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'Inactive or unknown staff actor cannot modify article in % status', OLD.status;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS articles_enforce_workflow ON public.articles;
CREATE TRIGGER articles_enforce_workflow
  BEFORE UPDATE ON public.articles
  FOR EACH ROW
  EXECUTE FUNCTION public.cms_enforce_article_workflow();

-- Single transactional workflow transition RPC callable strictly by `service_role`.
-- Resolves actor role strictly from `public.staff_users`; never trusts any
-- browser-supplied role parameter. Validates optional `p_action` against a strict
-- canonical allowlist & 64-char cap.
CREATE OR REPLACE FUNCTION public.cms_transition_article_status(
  p_article_id UUID,
  p_to_status TEXT,
  p_actor_staff_id UUID DEFAULT NULL,
  p_actor_type TEXT DEFAULT 'staff',
  p_scheduled_at TIMESTAMPTZ DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_action TEXT DEFAULT NULL
)
RETURNS public.articles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_article public.articles%ROWTYPE;
  v_updated public.articles%ROWTYPE;
  v_staff public.staff_users%ROWTYPE;
  v_prev_snapshot JSONB;
  v_next_snapshot JSONB;
  v_action_name TEXT;
  v_permitted BOOLEAN := FALSE;
BEGIN
  IF p_actor_type NOT IN ('staff', 'cron') THEN
    RAISE EXCEPTION 'Invalid workflow actor_type: %', p_actor_type;
  END IF;

  IF p_to_status NOT IN ('draft', 'review', 'approved', 'scheduled', 'published', 'archived') THEN
    RAISE EXCEPTION 'Invalid target editorial status: %', p_to_status;
  END IF;

  -- Strict allowlist + length cap for optional explicit action label
  IF p_action IS NOT NULL THEN
    v_action_name := NULLIF(TRIM(p_action), '');
    IF v_action_name IS NOT NULL THEN
      IF LENGTH(v_action_name) > 64 OR v_action_name NOT IN (
        'submit_for_review',
        'request_changes',
        'approve',
        'return_approved',
        'schedule',
        'unschedule',
        'publish_now',
        'cron_publish_scheduled',
        'archive',
        'restore_to_draft'
      ) THEN
        RAISE EXCEPTION 'Disallowed or oversized workflow p_action value';
      END IF;
    END IF;
  END IF;

  SELECT *
  INTO v_article
  FROM public.articles
  WHERE id = p_article_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Article % not found', p_article_id;
  END IF;

  IF v_article.status = p_to_status THEN
    RAISE EXCEPTION 'Article is already in % status', p_to_status;
  END IF;

  -- Authorize actor strictly against server database state
  IF p_actor_type = 'cron' THEN
    IF NOT (v_article.status = 'scheduled' AND p_to_status = 'published') THEN
      RAISE EXCEPTION 'Cron actor may only transition scheduled -> published (attempted % -> %)', v_article.status, p_to_status;
    END IF;
    IF v_article.scheduled_at IS NULL OR v_article.scheduled_at > NOW() THEN
      RAISE EXCEPTION 'Scheduled article % is not due for publication yet', p_article_id;
    END IF;
    IF v_article.next_retry_at IS NOT NULL AND v_article.next_retry_at > NOW() THEN
      RAISE EXCEPTION 'Scheduled article % is in retry backoff window', p_article_id;
    END IF;
  ELSE
    IF p_actor_staff_id IS NULL THEN
      RAISE EXCEPTION 'p_actor_staff_id is required for staff workflow transitions';
    END IF;

    SELECT *
    INTO v_staff
    FROM public.staff_users
    WHERE id = p_actor_staff_id;

    IF NOT FOUND OR v_staff.is_active IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'Staff actor % is unregistered or inactive', p_actor_staff_id;
    END IF;

    -- Enforce exact transition + DB-verified role matrix (aligned with A-2)
    v_permitted := CASE
      WHEN v_article.status = 'draft' AND p_to_status = 'review'
        THEN v_staff.role IN ('editor', 'publisher', 'admin')
      WHEN v_article.status = 'review' AND p_to_status = 'draft'
        THEN v_staff.role IN ('editor', 'publisher', 'admin')
      WHEN v_article.status = 'review' AND p_to_status = 'approved'
        THEN v_staff.role IN ('publisher', 'admin')
      WHEN v_article.status = 'approved' AND p_to_status IN ('draft', 'review', 'scheduled', 'published')
        THEN v_staff.role IN ('publisher', 'admin')
      WHEN v_article.status = 'scheduled' AND p_to_status IN ('approved', 'draft', 'published')
        THEN v_staff.role IN ('publisher', 'admin')
      WHEN v_article.status = 'published' AND p_to_status = 'archived'
        THEN v_staff.role IN ('publisher', 'admin')
      WHEN v_article.status = 'archived' AND p_to_status = 'draft'
        THEN v_staff.role IN ('publisher', 'admin')
      ELSE FALSE
    END;

    IF NOT v_permitted THEN
      RAISE EXCEPTION 'Role % is not authorized for transition % -> %', v_staff.role, v_article.status, p_to_status;
    END IF;
  END IF;

  IF p_to_status = 'scheduled' AND p_scheduled_at IS NULL THEN
    RAISE EXCEPTION 'scheduled_at timestamp is required when scheduling an article';
  END IF;

  v_prev_snapshot := public.cms_article_audit_snapshot(v_article);

  IF v_action_name IS NULL THEN
    v_action_name := CASE
      WHEN p_actor_type = 'cron' THEN 'cron_publish_scheduled'
      WHEN v_article.status = 'draft' AND p_to_status = 'review' THEN 'submit_for_review'
      WHEN v_article.status = 'review' AND p_to_status = 'draft' THEN 'request_changes'
      WHEN v_article.status = 'review' AND p_to_status = 'approved' THEN 'approve'
      WHEN v_article.status = 'approved' AND p_to_status IN ('draft', 'review') THEN 'return_approved'
      WHEN p_to_status = 'scheduled' THEN 'schedule'
      WHEN v_article.status = 'scheduled' AND p_to_status IN ('approved', 'draft') THEN 'unschedule'
      WHEN p_to_status = 'published' THEN 'publish_now'
      WHEN p_to_status = 'archived' THEN 'archive'
      WHEN v_article.status = 'archived' AND p_to_status = 'draft' THEN 'restore_to_draft'
      ELSE 'status_transition'
    END;
  END IF;

  -- Mark local transaction flags for workflow trigger & atomic audit log capture
  PERFORM set_config('strovyn.workflow_rpc', 'cms_transition_article_status', true);
  PERFORM set_config('strovyn.audit_captured', 'true', true);

  UPDATE public.articles
  SET
    status = p_to_status,
    scheduled_at = CASE
      WHEN p_to_status = 'scheduled' THEN p_scheduled_at
      WHEN v_article.status = 'scheduled' AND p_to_status IN ('approved', 'draft', 'published') THEN NULL
      ELSE scheduled_at
    END,
    published_at = CASE
      WHEN p_to_status = 'published' THEN COALESCE(published_at, NOW())
      ELSE published_at
    END,
    approved_by = CASE
      WHEN p_to_status = 'approved' AND p_actor_type = 'staff' THEN v_staff.id
      ELSE approved_by
    END,
    approved_at = CASE
      WHEN p_to_status = 'approved' THEN NOW()
      ELSE approved_at
    END,
    published_by = CASE
      WHEN p_to_status = 'published' AND p_actor_type = 'staff' THEN v_staff.id
      ELSE published_by
    END,
    archived_by = CASE
      WHEN p_to_status = 'archived' AND p_actor_type = 'staff' THEN v_staff.id
      ELSE archived_by
    END,
    archived_at = CASE
      WHEN p_to_status = 'archived' THEN NOW()
      ELSE archived_at
    END,
    last_publish_error = CASE
      WHEN p_to_status IN ('scheduled', 'published') THEN NULL
      ELSE last_publish_error
    END,
    next_retry_at = CASE
      WHEN p_to_status IN ('scheduled', 'published') THEN NULL
      ELSE next_retry_at
    END,
    updated_by = CASE
      WHEN p_actor_type = 'staff' THEN v_staff.id
      ELSE updated_by
    END
  WHERE id = p_article_id
  RETURNING * INTO v_updated;

  v_next_snapshot := public.cms_article_audit_snapshot(v_updated);

  INSERT INTO public.article_audit_log (
    article_id,
    actor_staff_id,
    actor_type,
    actor_email,
    actor_role,
    action,
    from_status,
    to_status,
    note,
    previous_snapshot,
    new_snapshot,
    metadata
  ) VALUES (
    v_updated.id,
    CASE WHEN p_actor_type = 'staff' THEN v_staff.id ELSE NULL END,
    p_actor_type,
    CASE WHEN p_actor_type = 'staff' THEN v_staff.email ELSE NULL END,
    CASE WHEN p_actor_type = 'staff' THEN v_staff.role ELSE 'system' END,
    v_action_name,
    v_article.status,
    v_updated.status,
    p_note,
    v_prev_snapshot,
    v_next_snapshot,
    jsonb_build_object('source', 'cms_transition_article_status')
  );

  RETURN v_updated;
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. Explicit table & function privilege revocations (A-4, Ph4)
-- ----------------------------------------------------------------------------
REVOKE ALL ON TABLE public.articles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.articles TO anon, authenticated;

REVOKE ALL ON TABLE public.staff_users FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.staff_users TO authenticated;

REVOKE ALL ON TABLE public.article_audit_log FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.cms_touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_article_audit_log_mutation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_article_audit_log_truncate() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cms_article_editorial_snapshot(public.articles) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cms_article_audit_snapshot(public.articles) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cms_audit_article_changes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cms_prevent_article_hard_delete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cms_enforce_article_workflow() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cms_transition_article_status(UUID, TEXT, UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE public.articles TO service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.staff_users TO service_role;
    GRANT SELECT, INSERT ON TABLE public.article_audit_log TO service_role;
    GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;
    GRANT EXECUTE ON FUNCTION public.cms_article_editorial_snapshot(public.articles) TO service_role;
    GRANT EXECUTE ON FUNCTION public.cms_article_audit_snapshot(public.articles) TO service_role;
    GRANT EXECUTE ON FUNCTION public.cms_transition_article_status(UUID, TEXT, UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT) TO service_role;
  END IF;
END;
$$;
