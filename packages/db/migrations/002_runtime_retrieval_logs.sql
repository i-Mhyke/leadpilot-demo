-- Retrieval logging (Phase 2)

CREATE TABLE IF NOT EXISTS retrieval_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid REFERENCES firms(id) ON DELETE SET NULL,
  conversation_id uuid,
  message_id uuid,
  query text NOT NULL,
  result_chunk_ids uuid[] NOT NULL DEFAULT '{}',
  result_document_ids uuid[] NOT NULL DEFAULT '{}',
  top_similarity numeric,
  used_graph_expansion boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retrieval_logs_firm_created ON retrieval_logs (firm_id, created_at DESC);
