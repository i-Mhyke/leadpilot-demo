-- Persist the full Eve session cursor so browser reloads and thread switches can resume safely.

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS eve_stream_index integer NOT NULL DEFAULT 0;
