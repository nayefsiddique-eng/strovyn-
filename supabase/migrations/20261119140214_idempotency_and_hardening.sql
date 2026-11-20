-- Additive database hardening & atomic idempotency support (compatible with 001_initial_schema.sql)
-- Apply in Supabase SQL Editor or migration pipeline before enabling cross-instance DB idempotency.

ALTER TABLE IF EXISTS quote_requests
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS quote_requests_idempotency_key_uidx
  ON quote_requests (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE IF EXISTS job_applications
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS job_applications_idempotency_key_uidx
  ON job_applications (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE IF EXISTS customer_feedback
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS customer_feedback_idempotency_key_uidx
  ON customer_feedback (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
