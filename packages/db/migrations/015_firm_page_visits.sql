-- Firm page visit tracking (Phase 7)

CREATE TABLE IF NOT EXISTS firm_page_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  page_key text NOT NULL CHECK (page_key IN ('ask', 'dashboard')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_firm_page_visits_firm_page_created
  ON firm_page_visits (firm_id, page_key, created_at DESC);
