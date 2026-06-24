-- First-class booking timestamp for date/time picker driven intake

ALTER TABLE booking_requests
  ADD COLUMN IF NOT EXISTS preferred_booking_at timestamptz;
