-- Retrieval audit columns (Phase 2 table always created in 002)

ALTER TABLE retrieval_logs
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ok'
    CHECK (status IN ('ok', 'empty', 'failed'));

ALTER TABLE retrieval_logs
  ADD COLUMN IF NOT EXISTS error_message text;

-- Legal knowledge firm scoping depends on the ingestion-owned schema.
-- Skip safely when legal_unit_chunks has not been created yet.
DO $$
BEGIN
  IF to_regclass('public.legal_unit_chunks') IS NOT NULL THEN
    ALTER TABLE legal_unit_chunks
      ADD COLUMN IF NOT EXISTS firm_id uuid REFERENCES firms(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_legal_unit_chunks_firm_id ON legal_unit_chunks (firm_id);
  END IF;
END $$;
