-- Chat request rate limiting buckets

CREATE TABLE IF NOT EXISTS request_rate_limits (
  scope text NOT NULL,
  rate_key text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL CHECK (count >= 1),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, rate_key)
);

CREATE INDEX IF NOT EXISTS idx_request_rate_limits_scope_window
  ON request_rate_limits (scope, window_start DESC);
