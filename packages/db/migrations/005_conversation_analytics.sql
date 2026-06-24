-- Conversation analytics (Phase 6)

CREATE TABLE IF NOT EXISTS conversation_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  topic text NOT NULL,
  normalized_topic text NOT NULL,
  service_id uuid REFERENCES firm_services(id) ON DELETE SET NULL,
  confidence numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversation_analysis_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  status text NOT NULL,
  analysis jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_insight_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  from_date timestamptz,
  to_date timestamptz,
  status text NOT NULL DEFAULT 'pending',
  summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS content_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  insight_run_id uuid REFERENCES content_insight_runs(id) ON DELETE SET NULL,
  topic text NOT NULL,
  format text NOT NULL,
  title text NOT NULL,
  rationale text NOT NULL,
  target_audience text,
  source_conversation_count int NOT NULL,
  draft text,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now()
);
