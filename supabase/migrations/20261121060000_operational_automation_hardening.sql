-- ============================================================================
-- STROVYN BUSINESS CMS — PHASE G: OPERATIONAL AUTOMATION & AI COST HARDENING
-- Migration 015 (Additive, idempotent, staging-safe)
-- ============================================================================

-- 1. Crash-recoverable lease table & atomic SKIP LOCKED claim RPC for scheduled articles
CREATE TABLE IF NOT EXISTS public.article_publish_claims (
  article_id UUID PRIMARY KEY REFERENCES public.articles(id) ON DELETE CASCADE,
  claim_token UUID NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lease_expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS article_publish_claims_lease_idx
  ON public.article_publish_claims (lease_expires_at);

CREATE INDEX IF NOT EXISTS articles_due_scheduled_idx
  ON public.articles (scheduled_at ASC, id ASC)
  WHERE status = 'scheduled';

ALTER TABLE public.article_publish_claims ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.article_publish_claims FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.article_publish_claims TO service_role;

CREATE OR REPLACE FUNCTION public.cms_claim_due_scheduled_articles(
  p_limit INT DEFAULT 10,
  p_lease_seconds INT DEFAULT 120
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  title TEXT,
  scheduled_at TIMESTAMPTZ,
  publish_attempts INT,
  claim_token UUID,
  lease_expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_limit INT := LEAST(GREATEST(COALESCE(p_limit, 10), 1), 50);
  v_lease_seconds INT := LEAST(GREATEST(COALESCE(p_lease_seconds, 120), 15), 900);
  v_lease_until TIMESTAMPTZ := NOW() + make_interval(secs => v_lease_seconds);
BEGIN
  -- Prune expired leases from crashed or interrupted workers before claiming
  DELETE FROM public.article_publish_claims c
  WHERE c.lease_expires_at <= NOW();

  RETURN QUERY
  WITH due AS (
    SELECT
      a.id,
      a.slug,
      a.title,
      a.scheduled_at,
      a.publish_attempts,
      gen_random_uuid() AS token
    FROM public.articles a
    WHERE a.status = 'scheduled'
      AND a.scheduled_at IS NOT NULL
      AND a.scheduled_at <= NOW()
      AND (a.next_retry_at IS NULL OR a.next_retry_at <= NOW())
      AND NOT EXISTS (
        SELECT 1
        FROM public.article_publish_claims c
        WHERE c.article_id = a.id
          AND c.lease_expires_at > NOW()
      )
    ORDER BY a.scheduled_at ASC, a.id ASC
    LIMIT v_limit
    FOR UPDATE OF a SKIP LOCKED
  ),
  claimed AS (
    INSERT INTO public.article_publish_claims (article_id, claim_token, claimed_at, lease_expires_at)
    SELECT d.id, d.token, NOW(), v_lease_until
    FROM due d
    ON CONFLICT (article_id) DO UPDATE
      SET claim_token = EXCLUDED.claim_token,
          claimed_at = EXCLUDED.claimed_at,
          lease_expires_at = EXCLUDED.lease_expires_at
      WHERE public.article_publish_claims.lease_expires_at <= NOW()
    RETURNING
      public.article_publish_claims.article_id,
      public.article_publish_claims.claim_token,
      public.article_publish_claims.lease_expires_at
  )
  SELECT
    d.id,
    d.slug,
    d.title,
    d.scheduled_at,
    d.publish_attempts,
    c.claim_token,
    c.lease_expires_at
  FROM due d
  INNER JOIN claimed c ON c.article_id = d.id;
END;
$$;

REVOKE ALL ON FUNCTION public.cms_claim_due_scheduled_articles(INT, INT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cms_claim_due_scheduled_articles(INT, INT)
  TO service_role;

CREATE OR REPLACE FUNCTION public.cms_release_article_publish_claim(
  p_article_id UUID,
  p_claim_token UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_deleted INT := 0;
BEGIN
  DELETE FROM public.article_publish_claims
  WHERE article_id = p_article_id
    AND claim_token = p_claim_token;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.cms_release_article_publish_claim(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cms_release_article_publish_claim(UUID, UUID)
  TO service_role;

-- 2. Durable multi-instance AI Studio daily quota & cost accounting table
CREATE TABLE IF NOT EXISTS public.ai_studio_usage_daily (
  day_key DATE NOT NULL,
  scope_key TEXT NOT NULL,
  request_count INT NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  reserved_requests INT NOT NULL DEFAULT 0 CHECK (reserved_requests >= 0),
  succeeded_requests INT NOT NULL DEFAULT 0 CHECK (succeeded_requests >= 0),
  failed_requests INT NOT NULL DEFAULT 0 CHECK (failed_requests >= 0),
  estimated_tokens BIGINT NOT NULL DEFAULT 0 CHECK (estimated_tokens >= 0),
  reserved_tokens BIGINT NOT NULL DEFAULT 0 CHECK (reserved_tokens >= 0),
  estimated_cost_micros BIGINT NOT NULL DEFAULT 0 CHECK (estimated_cost_micros >= 0),
  reserved_cost_micros BIGINT NOT NULL DEFAULT 0 CHECK (reserved_cost_micros >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (day_key, scope_key)
);

ALTER TABLE public.ai_studio_usage_daily ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ai_studio_usage_daily FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_studio_usage_daily TO service_role;

-- Atomic reservation RPC checking both per-staff and global daily request,
-- token, and micro-dollar cost ceilings in a single serializable row-lock step.
CREATE OR REPLACE FUNCTION public.cms_reserve_ai_studio_quota(
  p_staff_id UUID,
  p_est_input_tokens INT,
  p_est_input_cost_micros INT,
  p_staff_req_limit INT DEFAULT 60,
  p_global_req_limit INT DEFAULT 250,
  p_staff_token_limit BIGINT DEFAULT 120000,
  p_global_token_limit BIGINT DEFAULT 500000,
  p_staff_cost_limit_micros BIGINT DEFAULT 250000,
  p_global_cost_limit_micros BIGINT DEFAULT 1000000
)
RETURNS TABLE (
  allowed BOOLEAN,
  denial_reason TEXT,
  staff_requests_today INT,
  global_requests_today INT,
  staff_tokens_today BIGINT,
  global_tokens_today BIGINT,
  staff_cost_micros_today BIGINT,
  global_cost_micros_today BIGINT,
  staff_reserved_requests INT,
  staff_succeeded_requests INT,
  staff_failed_requests INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_day DATE := (NOW() AT TIME ZONE 'UTC')::date;
  v_staff_scope TEXT := 'staff:' || p_staff_id::text;
  v_global_row public.ai_studio_usage_daily%ROWTYPE;
  v_staff_row public.ai_studio_usage_daily%ROWTYPE;
  v_tokens INT := GREATEST(COALESCE(p_est_input_tokens, 0), 0);
  v_cost INT := GREATEST(COALESCE(p_est_input_cost_micros, 0), 0);
BEGIN
  -- Ensure rows exist and lock in deterministic order (global first, then staff)
  INSERT INTO public.ai_studio_usage_daily (day_key, scope_key)
  VALUES (v_day, 'global'), (v_day, v_staff_scope)
  ON CONFLICT (day_key, scope_key) DO NOTHING;

  SELECT * INTO v_global_row
  FROM public.ai_studio_usage_daily
  WHERE day_key = v_day AND scope_key = 'global'
  FOR UPDATE;

  SELECT * INTO v_staff_row
  FROM public.ai_studio_usage_daily
  WHERE day_key = v_day AND scope_key = v_staff_scope
  FOR UPDATE;

  IF v_staff_row.request_count + 1 > p_staff_req_limit THEN
    RETURN QUERY SELECT FALSE, 'STAFF_REQUEST_LIMIT',
      v_staff_row.request_count, v_global_row.request_count,
      v_staff_row.estimated_tokens, v_global_row.estimated_tokens,
      v_staff_row.estimated_cost_micros, v_global_row.estimated_cost_micros,
      v_staff_row.reserved_requests, v_staff_row.succeeded_requests, v_staff_row.failed_requests;
    RETURN;
  END IF;

  IF v_global_row.request_count + 1 > p_global_req_limit THEN
    RETURN QUERY SELECT FALSE, 'GLOBAL_REQUEST_LIMIT',
      v_staff_row.request_count, v_global_row.request_count,
      v_staff_row.estimated_tokens, v_global_row.estimated_tokens,
      v_staff_row.estimated_cost_micros, v_global_row.estimated_cost_micros,
      v_staff_row.reserved_requests, v_staff_row.succeeded_requests, v_staff_row.failed_requests;
    RETURN;
  END IF;

  IF v_staff_row.estimated_tokens + v_tokens > p_staff_token_limit THEN
    RETURN QUERY SELECT FALSE, 'STAFF_TOKEN_BUDGET',
      v_staff_row.request_count, v_global_row.request_count,
      v_staff_row.estimated_tokens, v_global_row.estimated_tokens,
      v_staff_row.estimated_cost_micros, v_global_row.estimated_cost_micros,
      v_staff_row.reserved_requests, v_staff_row.succeeded_requests, v_staff_row.failed_requests;
    RETURN;
  END IF;

  IF v_global_row.estimated_tokens + v_tokens > p_global_token_limit THEN
    RETURN QUERY SELECT FALSE, 'GLOBAL_TOKEN_BUDGET',
      v_staff_row.request_count, v_global_row.request_count,
      v_staff_row.estimated_tokens, v_global_row.estimated_tokens,
      v_staff_row.estimated_cost_micros, v_global_row.estimated_cost_micros,
      v_staff_row.reserved_requests, v_staff_row.succeeded_requests, v_staff_row.failed_requests;
    RETURN;
  END IF;

  IF v_staff_row.estimated_cost_micros + v_cost > p_staff_cost_limit_micros THEN
    RETURN QUERY SELECT FALSE, 'STAFF_COST_CEILING',
      v_staff_row.request_count, v_global_row.request_count,
      v_staff_row.estimated_tokens, v_global_row.estimated_tokens,
      v_staff_row.estimated_cost_micros, v_global_row.estimated_cost_micros,
      v_staff_row.reserved_requests, v_staff_row.succeeded_requests, v_staff_row.failed_requests;
    RETURN;
  END IF;

  IF v_global_row.estimated_cost_micros + v_cost > p_global_cost_limit_micros THEN
    RETURN QUERY SELECT FALSE, 'GLOBAL_COST_CEILING',
      v_staff_row.request_count, v_global_row.request_count,
      v_staff_row.estimated_tokens, v_global_row.estimated_tokens,
      v_staff_row.estimated_cost_micros, v_global_row.estimated_cost_micros,
      v_staff_row.reserved_requests, v_staff_row.succeeded_requests, v_staff_row.failed_requests;
    RETURN;
  END IF;

  UPDATE public.ai_studio_usage_daily
  SET request_count = request_count + 1,
      reserved_requests = reserved_requests + 1,
      estimated_tokens = estimated_tokens + v_tokens,
      reserved_tokens = reserved_tokens + v_tokens,
      estimated_cost_micros = estimated_cost_micros + v_cost,
      reserved_cost_micros = reserved_cost_micros + v_cost,
      updated_at = NOW()
  WHERE day_key = v_day AND scope_key = 'global'
  RETURNING * INTO v_global_row;

  UPDATE public.ai_studio_usage_daily
  SET request_count = request_count + 1,
      reserved_requests = reserved_requests + 1,
      estimated_tokens = estimated_tokens + v_tokens,
      reserved_tokens = reserved_tokens + v_tokens,
      estimated_cost_micros = estimated_cost_micros + v_cost,
      reserved_cost_micros = reserved_cost_micros + v_cost,
      updated_at = NOW()
  WHERE day_key = v_day AND scope_key = v_staff_scope
  RETURNING * INTO v_staff_row;

  RETURN QUERY SELECT TRUE, NULL::TEXT,
    v_staff_row.request_count, v_global_row.request_count,
    v_staff_row.estimated_tokens, v_global_row.estimated_tokens,
    v_staff_row.estimated_cost_micros, v_global_row.estimated_cost_micros,
    v_staff_row.reserved_requests, v_staff_row.succeeded_requests, v_staff_row.failed_requests;
END;
$$;

REVOKE ALL ON FUNCTION public.cms_reserve_ai_studio_quota(
  UUID, INT, INT, INT, INT, BIGINT, BIGINT, BIGINT, BIGINT
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.cms_reserve_ai_studio_quota(
  UUID, INT, INT, INT, INT, BIGINT, BIGINT, BIGINT, BIGINT
) TO service_role;

-- Finalize a reserved AI Studio request:
--   - On success: converts reserved capacity into actual usage and increments succeeded_requests.
--   - On failure: releases reserved request/token/cost capacity and increments failed_requests.
CREATE OR REPLACE FUNCTION public.cms_record_ai_studio_usage(
  p_staff_id UUID,
  p_succeeded BOOLEAN DEFAULT TRUE,
  p_reserved_tokens INT DEFAULT 0,
  p_reserved_cost_micros INT DEFAULT 0,
  p_actual_total_tokens INT DEFAULT 0,
  p_actual_total_cost_micros INT DEFAULT 0
)
RETURNS TABLE (
  staff_requests_today INT,
  global_requests_today INT,
  staff_tokens_today BIGINT,
  global_tokens_today BIGINT,
  staff_cost_micros_today BIGINT,
  global_cost_micros_today BIGINT,
  staff_reserved_requests INT,
  staff_succeeded_requests INT,
  staff_failed_requests INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_day DATE := (NOW() AT TIME ZONE 'UTC')::date;
  v_staff_scope TEXT := 'staff:' || p_staff_id::text;
  v_res_tokens BIGINT := GREATEST(COALESCE(p_reserved_tokens, 0), 0);
  v_res_cost BIGINT := GREATEST(COALESCE(p_reserved_cost_micros, 0), 0);
  v_act_tokens BIGINT := GREATEST(COALESCE(p_actual_total_tokens, 0), 0);
  v_act_cost BIGINT := GREATEST(COALESCE(p_actual_total_cost_micros, 0), 0);
  v_global_row public.ai_studio_usage_daily%ROWTYPE;
  v_staff_row public.ai_studio_usage_daily%ROWTYPE;
BEGIN
  INSERT INTO public.ai_studio_usage_daily (day_key, scope_key)
  VALUES (v_day, 'global'), (v_day, v_staff_scope)
  ON CONFLICT (day_key, scope_key) DO NOTHING;

  SELECT * INTO v_global_row
  FROM public.ai_studio_usage_daily
  WHERE day_key = v_day AND scope_key = 'global'
  FOR UPDATE;

  SELECT * INTO v_staff_row
  FROM public.ai_studio_usage_daily
  WHERE day_key = v_day AND scope_key = v_staff_scope
  FOR UPDATE;

  IF COALESCE(p_succeeded, TRUE) THEN
    UPDATE public.ai_studio_usage_daily
    SET reserved_requests = GREATEST(0, reserved_requests - 1),
        succeeded_requests = succeeded_requests + 1,
        reserved_tokens = GREATEST(0, reserved_tokens - v_res_tokens),
        reserved_cost_micros = GREATEST(0, reserved_cost_micros - v_res_cost),
        estimated_tokens = GREATEST(0, estimated_tokens - v_res_tokens + v_act_tokens),
        estimated_cost_micros = GREATEST(0, estimated_cost_micros - v_res_cost + v_act_cost),
        updated_at = NOW()
    WHERE day_key = v_day AND scope_key = 'global'
    RETURNING * INTO v_global_row;

    UPDATE public.ai_studio_usage_daily
    SET reserved_requests = GREATEST(0, reserved_requests - 1),
        succeeded_requests = succeeded_requests + 1,
        reserved_tokens = GREATEST(0, reserved_tokens - v_res_tokens),
        reserved_cost_micros = GREATEST(0, reserved_cost_micros - v_res_cost),
        estimated_tokens = GREATEST(0, estimated_tokens - v_res_tokens + v_act_tokens),
        estimated_cost_micros = GREATEST(0, estimated_cost_micros - v_res_cost + v_act_cost),
        updated_at = NOW()
    WHERE day_key = v_day AND scope_key = v_staff_scope
    RETURNING * INTO v_staff_row;
  ELSE
    UPDATE public.ai_studio_usage_daily
    SET request_count = GREATEST(0, request_count - 1),
        reserved_requests = GREATEST(0, reserved_requests - 1),
        failed_requests = failed_requests + 1,
        reserved_tokens = GREATEST(0, reserved_tokens - v_res_tokens),
        reserved_cost_micros = GREATEST(0, reserved_cost_micros - v_res_cost),
        estimated_tokens = GREATEST(0, estimated_tokens - v_res_tokens),
        estimated_cost_micros = GREATEST(0, estimated_cost_micros - v_res_cost),
        updated_at = NOW()
    WHERE day_key = v_day AND scope_key = 'global'
    RETURNING * INTO v_global_row;

    UPDATE public.ai_studio_usage_daily
    SET request_count = GREATEST(0, request_count - 1),
        reserved_requests = GREATEST(0, reserved_requests - 1),
        failed_requests = failed_requests + 1,
        reserved_tokens = GREATEST(0, reserved_tokens - v_res_tokens),
        reserved_cost_micros = GREATEST(0, reserved_cost_micros - v_res_cost),
        estimated_tokens = GREATEST(0, estimated_tokens - v_res_tokens),
        estimated_cost_micros = GREATEST(0, estimated_cost_micros - v_res_cost),
        updated_at = NOW()
    WHERE day_key = v_day AND scope_key = v_staff_scope
    RETURNING * INTO v_staff_row;
  END IF;

  RETURN QUERY SELECT
    v_staff_row.request_count, v_global_row.request_count,
    v_staff_row.estimated_tokens, v_global_row.estimated_tokens,
    v_staff_row.estimated_cost_micros, v_global_row.estimated_cost_micros,
    v_staff_row.reserved_requests, v_staff_row.succeeded_requests, v_staff_row.failed_requests;
END;
$$;

REVOKE ALL ON FUNCTION public.cms_record_ai_studio_usage(UUID, BOOLEAN, INT, INT, INT, INT)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.cms_record_ai_studio_usage(UUID, BOOLEAN, INT, INT, INT, INT)
  TO service_role;
