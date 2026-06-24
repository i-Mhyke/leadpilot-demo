-- Lead qualification and booking requests (Phase 4)

CREATE TABLE IF NOT EXISTS lead_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  visitor_id uuid REFERENCES visitors(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'new',
  temperature text NOT NULL DEFAULT 'cold',
  score int NOT NULL DEFAULT 0,
  primary_service_id uuid REFERENCES firm_services(id) ON DELETE SET NULL,
  name text,
  email text,
  phone text,
  company_name text,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (firm_id, conversation_id)
);

CREATE TABLE IF NOT EXISTS lead_score_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES lead_profiles(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  firm_id uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  score int NOT NULL,
  temperature text NOT NULL,
  factors jsonb NOT NULL,
  reason text NOT NULL,
  created_by text NOT NULL DEFAULT 'agent',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS booking_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES lead_profiles(id) ON DELETE SET NULL,
  visitor_id uuid REFERENCES visitors(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'requested',
  service_id uuid REFERENCES firm_services(id) ON DELETE SET NULL,
  routing_group text,
  visitor_name text,
  visitor_email text,
  visitor_phone text,
  company_name text,
  preferred_time_text text,
  matter_summary text NOT NULL,
  lead_brief text NOT NULL,
  urgency text,
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_requests_firm_status ON booking_requests (firm_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_booking_requests_conversation ON booking_requests (conversation_id);
