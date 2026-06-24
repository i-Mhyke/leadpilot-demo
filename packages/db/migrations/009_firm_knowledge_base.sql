-- Firm knowledge base: versioned tenant-scoped company documents and chunks

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS firm_knowledge_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  source_key text NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  title text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('website','manual','policy','faq','publication')),
  source_uri text,
  content_markdown text NOT NULL CHECK (length(btrim(content_markdown)) > 0),
  content_hash text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  expected_chunk_count integer NOT NULL CHECK (expected_chunk_count >= 1),
  embedding_model text NOT NULL,
  embedding_dimensions integer NOT NULL CHECK (embedding_dimensions = 1536),
  effective_at timestamptz,
  published_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, firm_id),
  UNIQUE (firm_id, source_key, version),
  UNIQUE (firm_id, source_key, content_hash, embedding_model, embedding_dimensions)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_firm_kb_one_published_source
  ON firm_knowledge_documents (firm_id, source_key)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_firm_kb_documents_firm_status
  ON firm_knowledge_documents (firm_id, status);

CREATE INDEX IF NOT EXISTS idx_firm_kb_documents_firm_source
  ON firm_knowledge_documents (firm_id, source_key);

CREATE TABLE IF NOT EXISTS firm_knowledge_chunks (
  id text PRIMARY KEY,
  document_id uuid NOT NULL,
  firm_id uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  chunk_count integer NOT NULL,
  heading_path text[] NOT NULL DEFAULT '{}',
  content_type text NOT NULL CHECK (content_type IN (
    'overview','service','person','publication','contact','compliance','positioning','other'
  )),
  chunk_text text NOT NULL CHECK (length(btrim(chunk_text)) > 0),
  text_hash text NOT NULL,
  estimated_tokens integer NOT NULL CHECK (estimated_tokens > 0),
  embedding vector(1536),
  embedding_model text,
  embedding_dimensions integer,
  embedded_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  fts tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(chunk_text, ''))) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_firm_kb_chunk_document_owner
    FOREIGN KEY (document_id, firm_id)
    REFERENCES firm_knowledge_documents(id, firm_id)
    ON DELETE CASCADE,
  CONSTRAINT firm_kb_chunk_index_valid CHECK (chunk_index >= 1 AND chunk_count >= chunk_index),
  CONSTRAINT firm_kb_embedding_dimensions CHECK (
    embedding_dimensions IS NULL OR embedding_dimensions = 1536
  ),
  UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_firm_kb_chunks_firm_document
  ON firm_knowledge_chunks (firm_id, document_id);

CREATE INDEX IF NOT EXISTS idx_firm_kb_chunks_fts
  ON firm_knowledge_chunks USING gin (fts);

CREATE INDEX IF NOT EXISTS idx_firm_kb_documents_metadata
  ON firm_knowledge_documents USING gin (metadata);

CREATE INDEX IF NOT EXISTS idx_firm_kb_chunks_metadata
  ON firm_knowledge_chunks USING gin (metadata);

CREATE INDEX IF NOT EXISTS idx_firm_kb_chunks_embedding_hnsw
  ON firm_knowledge_chunks
  USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;

ALTER TABLE retrieval_logs
  ADD COLUMN IF NOT EXISTS retrieval_scope text NOT NULL DEFAULT 'legal'
    CHECK (retrieval_scope IN ('legal', 'firm', 'both'));

ALTER TABLE retrieval_logs
  ADD COLUMN IF NOT EXISTS result_sources jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE retrieval_logs
  ADD COLUMN IF NOT EXISTS degraded_sources text[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.resolve_firm_knowledge_draft(
  p_firm_id uuid,
  p_source_key text,
  p_title text,
  p_source_type text,
  p_source_uri text,
  p_content_markdown text,
  p_content_hash text,
  p_expected_chunk_count integer,
  p_embedding_model text,
  p_embedding_dimensions integer,
  p_effective_at timestamptz,
  p_metadata jsonb
) RETURNS TABLE(document_id uuid, version integer, state text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_row public.firm_knowledge_documents%ROWTYPE;
  v_new_version integer;
  v_new_id uuid;
BEGIN
  IF p_embedding_dimensions IS DISTINCT FROM 1536 THEN
    RAISE EXCEPTION 'FIRM_KB_INVALID_DIMENSIONS' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_firm_id::text || ':' || p_source_key, 0));

  SELECT * INTO v_row
  FROM public.firm_knowledge_documents d
  WHERE d.firm_id = p_firm_id
    AND d.source_key = p_source_key
    AND d.content_hash = p_content_hash
    AND d.embedding_model = p_embedding_model
    AND d.embedding_dimensions = p_embedding_dimensions
  ORDER BY CASE d.status WHEN 'published' THEN 1 WHEN 'draft' THEN 2 WHEN 'archived' THEN 3 END
  LIMIT 1;

  IF FOUND THEN
    IF v_row.status = 'published' THEN
      RETURN QUERY SELECT v_row.id, v_row.version, 'unchanged_published'::text;
      RETURN;
    ELSIF v_row.status = 'draft' THEN
      RETURN QUERY SELECT v_row.id, v_row.version, 'resumable_draft'::text;
      RETURN;
    ELSE
      RETURN QUERY SELECT v_row.id, v_row.version, 'archived_match'::text;
      RETURN;
    END IF;
  END IF;

  SELECT COALESCE(MAX(d.version), 0) + 1 INTO v_new_version
  FROM public.firm_knowledge_documents d
  WHERE d.firm_id = p_firm_id AND d.source_key = p_source_key;

  INSERT INTO public.firm_knowledge_documents (
    firm_id, source_key, version, title, source_type, source_uri,
    content_markdown, content_hash, status, expected_chunk_count,
    embedding_model, embedding_dimensions, effective_at, metadata
  ) VALUES (
    p_firm_id, p_source_key, v_new_version, p_title, p_source_type, p_source_uri,
    p_content_markdown, p_content_hash, 'draft', p_expected_chunk_count,
    p_embedding_model, p_embedding_dimensions, p_effective_at, COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_new_id;

  RETURN QUERY SELECT v_new_id, v_new_version, 'created_draft'::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.replace_firm_knowledge_draft_chunks(
  p_firm_id uuid,
  p_document_id uuid,
  p_chunks jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_doc public.firm_knowledge_documents%ROWTYPE;
  v_chunk jsonb;
  v_required_keys text[] := ARRAY[
    'id', 'chunkIndex', 'chunkCount', 'headingPath', 'contentType', 'chunkText',
    'textHash', 'estimatedTokens', 'embedding', 'embeddingModel', 'embeddingDimensions',
    'embeddedAt', 'metadata'
  ];
  v_key text;
  v_count integer := 0;
BEGIN
  IF jsonb_typeof(p_chunks) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'FIRM_KB_INVALID_CHUNKS' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_doc
  FROM public.firm_knowledge_documents
  WHERE id = p_document_id AND firm_id = p_firm_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIRM_KB_DOCUMENT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_doc.status <> 'draft' THEN
    RAISE EXCEPTION 'FIRM_KB_NOT_DRAFT' USING ERRCODE = '22023';
  END IF;

  v_count := jsonb_array_length(p_chunks);
  IF v_count > v_doc.expected_chunk_count THEN
    RAISE EXCEPTION 'FIRM_KB_TOO_MANY_CHUNKS' USING ERRCODE = '22023';
  END IF;

  FOR v_chunk IN SELECT value FROM jsonb_array_elements(p_chunks)
  LOOP
    IF jsonb_typeof(v_chunk) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'FIRM_KB_INVALID_CHUNK' USING ERRCODE = '22023';
    END IF;
    FOREACH v_key IN ARRAY v_required_keys
    LOOP
      IF NOT (v_chunk ? v_key) THEN
        RAISE EXCEPTION 'FIRM_KB_MISSING_CHUNK_FIELD' USING ERRCODE = '22023';
      END IF;
    END LOOP;
    IF EXISTS (
      SELECT 1
      FROM jsonb_object_keys(v_chunk) AS object_key
      WHERE object_key <> ALL (v_required_keys)
    ) THEN
      RAISE EXCEPTION 'FIRM_KB_UNKNOWN_CHUNK_FIELD' USING ERRCODE = '22023';
    END IF;
    IF (v_chunk->>'embeddingModel') IS DISTINCT FROM v_doc.embedding_model
       OR (v_chunk->>'embeddingDimensions')::integer IS DISTINCT FROM v_doc.embedding_dimensions
       OR (v_chunk->>'chunkCount')::integer IS DISTINCT FROM v_doc.expected_chunk_count THEN
      RAISE EXCEPTION 'FIRM_KB_CHUNK_FINGERPRINT_MISMATCH' USING ERRCODE = '22023';
    END IF;
  END LOOP;

  DELETE FROM public.firm_knowledge_chunks
  WHERE document_id = p_document_id AND firm_id = p_firm_id;

  INSERT INTO public.firm_knowledge_chunks (
    id, document_id, firm_id, chunk_index, chunk_count, heading_path, content_type,
    chunk_text, text_hash, estimated_tokens, embedding, embedding_model,
    embedding_dimensions, embedded_at, metadata
  )
  SELECT
    c->>'id',
    p_document_id,
    p_firm_id,
    (c->>'chunkIndex')::integer,
    (c->>'chunkCount')::integer,
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(c->'headingPath')), '{}'),
    c->>'contentType',
    c->>'chunkText',
    c->>'textHash',
    (c->>'estimatedTokens')::integer,
    (c->>'embedding')::vector(1536),
    c->>'embeddingModel',
    (c->>'embeddingDimensions')::integer,
    (c->>'embeddedAt')::timestamptz,
    COALESCE(c->'metadata', '{}'::jsonb)
  FROM jsonb_array_elements(p_chunks) AS c;
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_firm_knowledge_draft(
  p_firm_id uuid,
  p_document_id uuid,
  p_source_key text
) RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_doc public.firm_knowledge_documents%ROWTYPE;
  v_published public.firm_knowledge_documents%ROWTYPE;
  v_actual_count integer;
  v_missing_embeddings integer;
  v_bad_indexes integer;
  v_bad_chunk_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_firm_id::text || ':' || p_source_key, 0));

  SELECT * INTO v_doc
  FROM public.firm_knowledge_documents
  WHERE id = p_document_id AND firm_id = p_firm_id AND source_key = p_source_key
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIRM_KB_DOCUMENT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_doc.status <> 'draft' THEN
    RAISE EXCEPTION 'FIRM_KB_NOT_DRAFT' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_published
  FROM public.firm_knowledge_documents
  WHERE firm_id = p_firm_id AND source_key = p_source_key AND status = 'published'
  LIMIT 1;

  IF FOUND AND v_published.version >= v_doc.version THEN
    RETURN 'superseded';
  END IF;

  SELECT COUNT(*) INTO v_actual_count
  FROM public.firm_knowledge_chunks
  WHERE document_id = p_document_id AND firm_id = p_firm_id;

  IF v_actual_count <> v_doc.expected_chunk_count THEN
    RAISE EXCEPTION 'FIRM_KB_INCOMPLETE_CHUNKS' USING ERRCODE = '22023';
  END IF;

  SELECT COUNT(*) INTO v_missing_embeddings
  FROM public.firm_knowledge_chunks
  WHERE document_id = p_document_id AND firm_id = p_firm_id
    AND (embedding IS NULL OR embedding_model IS DISTINCT FROM v_doc.embedding_model
         OR embedding_dimensions IS DISTINCT FROM v_doc.embedding_dimensions);

  IF v_missing_embeddings > 0 THEN
    RAISE EXCEPTION 'FIRM_KB_MISSING_EMBEDDINGS' USING ERRCODE = '22023';
  END IF;

  SELECT COUNT(*) INTO v_bad_indexes
  FROM public.firm_knowledge_chunks c
  WHERE c.document_id = p_document_id AND c.firm_id = p_firm_id
    AND c.chunk_index NOT BETWEEN 1 AND v_doc.expected_chunk_count;

  IF v_bad_indexes > 0 OR (
    SELECT COUNT(DISTINCT chunk_index)
    FROM public.firm_knowledge_chunks
    WHERE document_id = p_document_id AND firm_id = p_firm_id
  ) <> v_doc.expected_chunk_count THEN
    RAISE EXCEPTION 'FIRM_KB_NON_CONTIGUOUS_CHUNKS' USING ERRCODE = '22023';
  END IF;

  SELECT COUNT(*) INTO v_bad_chunk_count
  FROM public.firm_knowledge_chunks
  WHERE document_id = p_document_id AND firm_id = p_firm_id
    AND chunk_count <> v_doc.expected_chunk_count;

  IF v_bad_chunk_count > 0 THEN
    RAISE EXCEPTION 'FIRM_KB_CHUNK_COUNT_MISMATCH' USING ERRCODE = '22023';
  END IF;

  UPDATE public.firm_knowledge_documents
  SET status = 'archived', updated_at = now()
  WHERE firm_id = p_firm_id AND source_key = p_source_key AND status = 'published';

  UPDATE public.firm_knowledge_documents
  SET status = 'published', published_at = now(), updated_at = now()
  WHERE id = p_document_id AND firm_id = p_firm_id;

  RETURN 'published';
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_archived_firm_knowledge_document(
  p_firm_id uuid,
  p_document_id uuid,
  p_source_key text,
  p_embedding_model text,
  p_embedding_dimensions integer
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_doc public.firm_knowledge_documents%ROWTYPE;
  v_actual_count integer;
  v_missing_embeddings integer;
BEGIN
  IF p_embedding_dimensions IS DISTINCT FROM 1536 THEN
    RAISE EXCEPTION 'FIRM_KB_INVALID_DIMENSIONS' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_firm_id::text || ':' || p_source_key, 0));

  SELECT * INTO v_doc
  FROM public.firm_knowledge_documents
  WHERE id = p_document_id AND firm_id = p_firm_id AND source_key = p_source_key
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIRM_KB_DOCUMENT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_doc.status <> 'archived' THEN
    RAISE EXCEPTION 'FIRM_KB_NOT_ARCHIVED' USING ERRCODE = '22023';
  END IF;

  IF v_doc.embedding_model IS DISTINCT FROM p_embedding_model
     OR v_doc.embedding_dimensions IS DISTINCT FROM p_embedding_dimensions THEN
    RAISE EXCEPTION 'FIRM_KB_FINGERPRINT_MISMATCH' USING ERRCODE = '22023';
  END IF;

  SELECT COUNT(*) INTO v_actual_count
  FROM public.firm_knowledge_chunks
  WHERE document_id = p_document_id AND firm_id = p_firm_id;

  IF v_actual_count <> v_doc.expected_chunk_count THEN
    RAISE EXCEPTION 'FIRM_KB_INCOMPLETE_CHUNKS' USING ERRCODE = '22023';
  END IF;

  SELECT COUNT(*) INTO v_missing_embeddings
  FROM public.firm_knowledge_chunks
  WHERE document_id = p_document_id AND firm_id = p_firm_id AND embedding IS NULL;

  IF v_missing_embeddings > 0 THEN
    RAISE EXCEPTION 'FIRM_KB_MISSING_EMBEDDINGS' USING ERRCODE = '22023';
  END IF;

  UPDATE public.firm_knowledge_documents
  SET status = 'archived', updated_at = now()
  WHERE firm_id = p_firm_id AND source_key = p_source_key AND status = 'published';

  UPDATE public.firm_knowledge_documents
  SET status = 'published', published_at = now(), updated_at = now()
  WHERE id = p_document_id AND firm_id = p_firm_id;
END;
$$;
