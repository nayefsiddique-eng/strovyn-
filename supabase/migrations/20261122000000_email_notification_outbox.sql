-- ============================================================================
-- STROVYN BUSINESS CMS — MIGRATION 016: DURABLE EMAIL NOTIFICATION OUTBOX
-- Additive, idempotent, zero-PII-duplication outbox for Resend reliability.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.email_notification_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_type TEXT NOT NULL
    CHECK (submission_type IN ('quote_request', 'job_application', 'customer_feedback')),
  submission_id UUID NOT NULL,
  idempotency_key TEXT NOT NULL
    CHECK (LENGTH(TRIM(idempotency_key)) > 0 AND LENGTH(TRIM(idempotency_key)) <= 128),
  recipient_kind TEXT NOT NULL DEFAULT 'default'
    CHECK (recipient_kind IN ('default', 'recruitment', 'customer_ack')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed_permanent')),
  attempts INT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts INT NOT NULL DEFAULT 5 CHECK (max_attempts >= 1 AND max_attempts <= 20),
  next_retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claim_token UUID,
  claim_expires_at TIMESTAMPTZ,
  last_error TEXT,
  provider_message_id TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT email_notification_outbox_type_key_uidx UNIQUE (submission_type, idempotency_key)
);

CREATE INDEX IF NOT EXISTS email_notification_outbox_due_idx
  ON public.email_notification_outbox (next_retry_at ASC, created_at ASC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS email_notification_outbox_claim_idx
  ON public.email_notification_outbox (claim_expires_at)
  WHERE claim_token IS NOT NULL;

ALTER TABLE public.email_notification_outbox ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.email_notification_outbox FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.email_notification_outbox TO service_role;

CREATE OR REPLACE FUNCTION public.cms_claim_due_email_outbox(
  p_limit INT DEFAULT 10,
  p_lease_seconds INT DEFAULT 60
)
RETURNS TABLE (
  id UUID,
  submission_type TEXT,
  submission_id UUID,
  idempotency_key TEXT,
  recipient_kind TEXT,
  attempts INT,
  max_attempts INT,
  claim_token UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_limit INT := LEAST(GREATEST(COALESCE(p_limit, 10), 1), 50);
  v_lease_seconds INT := LEAST(GREATEST(COALESCE(p_lease_seconds, 60), 15), 600);
  v_lease_until TIMESTAMPTZ := NOW() + make_interval(secs => v_lease_seconds);
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT
      e.id,
      gen_random_uuid() AS token
    FROM public.email_notification_outbox e
    WHERE e.status = 'pending'
      AND e.attempts < e.max_attempts
      AND e.next_retry_at <= NOW()
      AND (e.claim_token IS NULL OR e.claim_expires_at IS NULL OR e.claim_expires_at <= NOW())
    ORDER BY e.next_retry_at ASC, e.created_at ASC
    LIMIT v_limit
    FOR UPDATE OF e SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.email_notification_outbox o
    SET claim_token = d.token,
        claim_expires_at = v_lease_until,
        updated_at = NOW()
    FROM due d
    WHERE o.id = d.id
    RETURNING
      o.id,
      o.submission_type,
      o.submission_id,
      o.idempotency_key,
      o.recipient_kind,
      o.attempts,
      o.max_attempts,
      o.claim_token
  )
  SELECT
    c.id,
    c.submission_type,
    c.submission_id,
    c.idempotency_key,
    c.recipient_kind,
    c.attempts,
    c.max_attempts,
    c.claim_token
  FROM claimed c;
END;
$$;

REVOKE ALL ON FUNCTION public.cms_claim_due_email_outbox(INT, INT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cms_claim_due_email_outbox(INT, INT)
  TO service_role;

CREATE OR REPLACE FUNCTION public.cms_enqueue_submission_outbox_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_submission_type TEXT;
  v_recipient_kind TEXT;
  v_idempotency_key TEXT;
BEGIN
  IF TG_TABLE_NAME = 'quote_requests' THEN
    v_submission_type := 'quote_request';
    v_recipient_kind := 'default';
  ELSIF TG_TABLE_NAME = 'job_applications' THEN
    v_submission_type := 'job_application';
    v_recipient_kind := 'recruitment';
  ELSIF TG_TABLE_NAME = 'customer_feedback' THEN
    v_submission_type := 'customer_feedback';
    v_recipient_kind := 'default';
  ELSE
    RETURN NEW;
  END IF;

  v_idempotency_key := LEFT(
    COALESCE(NULLIF(TRIM(NEW.idempotency_key), ''), TG_TABLE_NAME || ':' || NEW.id::text),
    128
  );

  BEGIN
    INSERT INTO public.email_notification_outbox (
      submission_type,
      submission_id,
      idempotency_key,
      recipient_kind,
      status,
      attempts,
      max_attempts,
      next_retry_at
    )
    VALUES (
      v_submission_type,
      NEW.id,
      v_idempotency_key,
      v_recipient_kind,
      'pending',
      0,
      5,
      NOW()
    )
    ON CONFLICT (submission_type, idempotency_key) DO NOTHING;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING '[EMAIL OUTBOX DEGRADED] Trigger enqueue skipped for % (%): SQLSTATE=%',
        TG_TABLE_NAME, NEW.id, SQLSTATE;
  END;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.cms_enqueue_submission_outbox_trigger()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_quote_requests_enqueue_outbox ON public.quote_requests;
CREATE TRIGGER trg_quote_requests_enqueue_outbox
  AFTER INSERT ON public.quote_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.cms_enqueue_submission_outbox_trigger();

DROP TRIGGER IF EXISTS trg_job_applications_enqueue_outbox ON public.job_applications;
CREATE TRIGGER trg_job_applications_enqueue_outbox
  AFTER INSERT ON public.job_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.cms_enqueue_submission_outbox_trigger();

DROP TRIGGER IF EXISTS trg_customer_feedback_enqueue_outbox ON public.customer_feedback;
CREATE TRIGGER trg_customer_feedback_enqueue_outbox
  AFTER INSERT ON public.customer_feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.cms_enqueue_submission_outbox_trigger();

CREATE OR REPLACE FUNCTION public.cms_reconcile_missing_email_outbox(
  p_lookback_hours INT DEFAULT 168,
  p_limit INT DEFAULT 100
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_hours INT := GREATEST(1, LEAST(COALESCE(p_lookback_hours, 168), 720));
  v_limit INT := GREATEST(1, LEAST(COALESCE(p_limit, 100), 500));
  v_cutoff TIMESTAMPTZ := NOW() - make_interval(hours => v_hours);
  v_inserted INT := 0;
  v_step INT := 0;
BEGIN
  WITH missing_quotes AS (
    SELECT
      q.id AS submission_id,
      LEFT(COALESCE(NULLIF(TRIM(q.idempotency_key), ''), 'quote_requests:' || q.id::text), 128) AS idempotency_key
    FROM public.quote_requests q
    WHERE q.created_at >= v_cutoff
      AND NOT EXISTS (
        SELECT 1
        FROM public.email_notification_outbox o
        WHERE o.submission_type = 'quote_request'
          AND o.submission_id = q.id
          AND o.recipient_kind IN ('default', 'recruitment')
      )
    ORDER BY q.created_at ASC
    LIMIT v_limit
  )
  INSERT INTO public.email_notification_outbox (
    submission_type,
    submission_id,
    idempotency_key,
    recipient_kind,
    status,
    attempts,
    max_attempts,
    next_retry_at
  )
  SELECT
    'quote_request',
    mq.submission_id,
    mq.idempotency_key,
    'default',
    'pending',
    0,
    5,
    NOW()
  FROM missing_quotes mq
  ON CONFLICT (submission_type, idempotency_key) DO NOTHING;

  GET DIAGNOSTICS v_step = ROW_COUNT;
  v_inserted := v_inserted + v_step;

  WITH missing_apps AS (
    SELECT
      a.id AS submission_id,
      LEFT(COALESCE(NULLIF(TRIM(a.idempotency_key), ''), 'job_applications:' || a.id::text), 128) AS idempotency_key
    FROM public.job_applications a
    WHERE a.created_at >= v_cutoff
      AND NOT EXISTS (
        SELECT 1
        FROM public.email_notification_outbox o
        WHERE o.submission_type = 'job_application'
          AND o.submission_id = a.id
          AND o.recipient_kind IN ('default', 'recruitment')
      )
    ORDER BY a.created_at ASC
    LIMIT v_limit
  )
  INSERT INTO public.email_notification_outbox (
    submission_type,
    submission_id,
    idempotency_key,
    recipient_kind,
    status,
    attempts,
    max_attempts,
    next_retry_at
  )
  SELECT
    'job_application',
    ma.submission_id,
    ma.idempotency_key,
    'recruitment',
    'pending',
    0,
    5,
    NOW()
  FROM missing_apps ma
  ON CONFLICT (submission_type, idempotency_key) DO NOTHING;

  GET DIAGNOSTICS v_step = ROW_COUNT;
  v_inserted := v_inserted + v_step;

  WITH missing_feedback AS (
    SELECT
      f.id AS submission_id,
      LEFT(COALESCE(NULLIF(TRIM(f.idempotency_key), ''), 'customer_feedback:' || f.id::text), 128) AS idempotency_key
    FROM public.customer_feedback f
    WHERE f.created_at >= v_cutoff
      AND NOT EXISTS (
        SELECT 1
        FROM public.email_notification_outbox o
        WHERE o.submission_type = 'customer_feedback'
          AND o.submission_id = f.id
          AND o.recipient_kind IN ('default', 'recruitment')
      )
    ORDER BY f.created_at ASC
    LIMIT v_limit
  )
  INSERT INTO public.email_notification_outbox (
    submission_type,
    submission_id,
    idempotency_key,
    recipient_kind,
    status,
    attempts,
    max_attempts,
    next_retry_at
  )
  SELECT
    'customer_feedback',
    mf.submission_id,
    mf.idempotency_key,
    'default',
    'pending',
    0,
    5,
    NOW()
  FROM missing_feedback mf
  ON CONFLICT (submission_type, idempotency_key) DO NOTHING;

  GET DIAGNOSTICS v_step = ROW_COUNT;
  v_inserted := v_inserted + v_step;

  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.cms_reconcile_missing_email_outbox(INT, INT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cms_reconcile_missing_email_outbox(INT, INT)
  TO service_role;
