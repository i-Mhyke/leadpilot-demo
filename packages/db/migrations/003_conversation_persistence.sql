-- Conversation persistence (Phase 3)

CREATE TABLE IF NOT EXISTS visitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  anonymous_key text,
  name text,
  email text,
  phone text,
  company_name text,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visitors_firm_anonymous ON visitors (firm_id, anonymous_key);
CREATE INDEX IF NOT EXISTS idx_visitors_firm_email ON visitors (firm_id, email);

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  visitor_id uuid NOT NULL REFERENCES visitors(id) ON DELETE CASCADE,
  eve_session_id text,
  eve_continuation_token text,
  status text NOT NULL DEFAULT 'open',
  phase text NOT NULL DEFAULT 'listen',
  source_url text,
  firm_slug text,
  matter_summary text,
  primary_service_id uuid REFERENCES firm_services(id) ON DELETE SET NULL,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_firm_created ON conversations (firm_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_firm_status ON conversations (firm_id, status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_eve_session ON conversations (eve_session_id);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  firm_id uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  event_type text,
  eve_turn_id text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversation_messages_eve_turn
  ON conversation_messages (conversation_id, eve_turn_id)
  WHERE eve_turn_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS conversation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  firm_id uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversation_events_conversation ON conversation_events (conversation_id, created_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_retrieval_logs_conversation'
  ) THEN
    ALTER TABLE retrieval_logs
      ADD CONSTRAINT fk_retrieval_logs_conversation
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL;
  END IF;
END $$;
