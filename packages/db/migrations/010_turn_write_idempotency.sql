-- Turn write idempotency for agent tool retries and stream recovery

ALTER TABLE lead_score_events
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_score_events_idempotency_key
  ON lead_score_events (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE booking_requests
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_requests_idempotency_key
  ON booking_requests (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Keep the newest open booking per conversation before enforcing uniqueness.
WITH duplicate_open_bookings AS (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY firm_id, conversation_id
        ORDER BY created_at DESC, id DESC
      ) AS row_number
    FROM booking_requests
    WHERE status = 'requested'
  ) ranked
  WHERE ranked.row_number > 1
)
UPDATE booking_requests
SET status = 'cancelled',
    updated_at = now()
WHERE id IN (SELECT id FROM duplicate_open_bookings);

CREATE UNIQUE INDEX IF NOT EXISTS uq_booking_requests_open_conversation
  ON booking_requests (firm_id, conversation_id)
  WHERE status = 'requested';
