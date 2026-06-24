-- Firm instance and service model (Phase 1)

CREATE TABLE IF NOT EXISTS firms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  industry text NOT NULL,
  jurisdiction text,
  website_url text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS firm_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text NOT NULL,
  visitor_examples jsonb NOT NULL DEFAULT '[]',
  qualification_questions jsonb NOT NULL DEFAULT '[]',
  urgency_signals jsonb NOT NULL DEFAULT '[]',
  required_booking_fields jsonb NOT NULL DEFAULT '[]',
  routing_group text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (firm_id, slug)
);

CREATE TABLE IF NOT EXISTS firm_booking_policies (
  firm_id uuid PRIMARY KEY REFERENCES firms(id) ON DELETE CASCADE,
  booking_mode text NOT NULL DEFAULT 'request_only',
  contact_capture_threshold int NOT NULL DEFAULT 55,
  booking_offer_threshold int NOT NULL DEFAULT 70,
  required_contact_fields jsonb NOT NULL DEFAULT '["name","email","matter_summary"]',
  allow_phone_capture boolean NOT NULL DEFAULT true,
  calendar_provider text,
  calendar_routing_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS firm_pricing_policies (
  firm_id uuid PRIMARY KEY REFERENCES firms(id) ON DELETE CASCADE,
  can_discuss_fees boolean NOT NULL DEFAULT false,
  fee_summary text,
  fee_disclaimer text,
  requires_human_for_fee_questions boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS firm_agent_tone_profiles (
  firm_id uuid PRIMARY KEY REFERENCES firms(id) ON DELETE CASCADE,
  voice text NOT NULL DEFAULT 'warm_professional',
  formality_level text NOT NULL DEFAULT 'balanced',
  preferred_greeting text,
  avoid_phrases jsonb NOT NULL DEFAULT '[]',
  signature_disclaimer text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_firm_services_firm_active ON firm_services (firm_id, is_active);
