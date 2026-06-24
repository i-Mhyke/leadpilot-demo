-- Legal knowledge chunk and document identifiers are text IDs from the ingestion pipeline.
-- Earlier app migrations used uuid[] before the Neon pgvector schema was finalized.

ALTER TABLE retrieval_logs
  ALTER COLUMN result_chunk_ids TYPE text[] USING result_chunk_ids::text[],
  ALTER COLUMN result_document_ids TYPE text[] USING result_document_ids::text[];
