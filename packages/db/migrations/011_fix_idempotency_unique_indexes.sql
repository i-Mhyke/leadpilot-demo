-- Partial unique indexes from 010 do not satisfy plain ON CONFLICT (idempotency_key).
-- Replace with full unique indexes (PostgreSQL treats NULL keys as distinct).

DROP INDEX IF EXISTS idx_lead_score_events_idempotency_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_score_events_idempotency_key
  ON lead_score_events (idempotency_key);

DROP INDEX IF EXISTS idx_booking_requests_idempotency_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_requests_idempotency_key
  ON booking_requests (idempotency_key);
