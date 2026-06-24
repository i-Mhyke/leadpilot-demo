-- Firm brain control-plane config and conversation snapshot storage

CREATE TABLE IF NOT EXISTS firm_brains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  source_filename text NOT NULL,
  raw_markdown text NOT NULL CHECK (length(btrim(raw_markdown)) > 0),
  content_hash text NOT NULL,
  revision integer NOT NULL CHECK (revision >= 1),
  compiled_json jsonb NOT NULL,
  compiled_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (firm_id)
);

CREATE INDEX IF NOT EXISTS idx_firm_brains_firm_revision
  ON firm_brains (firm_id, revision DESC);

CREATE INDEX IF NOT EXISTS idx_firm_brains_content_hash
  ON firm_brains (content_hash);

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS brain_snapshot jsonb;
