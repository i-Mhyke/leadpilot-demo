import { getSql } from "./client.ts";
import { rows as toRows } from "./sql.ts";

export type RetrievalStatus = "ok" | "empty" | "failed";
export type RetrievalScope = "legal" | "firm" | "both";

export interface RetrievalResultSource {
  source: "legal" | "firm";
  chunkId: string;
  documentId: string;
  rank: number;
}

export interface RetrievalLogInput {
  firmId?: string;
  conversationId?: string;
  messageId?: string;
  query: string;
  resultChunkIds: string[];
  resultDocumentIds: string[];
  topSimilarity?: number;
  usedGraphExpansion?: boolean;
  status?: RetrievalStatus;
  errorMessage?: string;
  retrievalScope?: RetrievalScope;
  resultSources?: RetrievalResultSource[];
  degradedSources?: string[];
}

export async function logRetrieval(input: RetrievalLogInput): Promise<string> {
  const sql = getSql();
  const scope = input.retrievalScope ?? "legal";

  try {
    return await insertRetrievalLog(sql, { ...input, retrievalScope: scope }, "full");
  } catch (error) {
    if (isMissingRetrievalScopeColumnError(error)) {
      try {
        return await insertRetrievalLog(sql, { ...input, retrievalScope: scope }, "extended");
      } catch (innerError) {
        if (!isMissingRetrievalAuditColumnError(innerError)) {
          throw innerError;
        }
        return insertRetrievalLog(sql, { ...input, retrievalScope: scope }, "legacy");
      }
    }
    if (!isMissingRetrievalAuditColumnError(error)) {
      throw error;
    }
    return insertRetrievalLog(sql, { ...input, retrievalScope: scope }, "legacy");
  }
}

function isMissingRetrievalScopeColumnError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /column "(retrieval_scope|result_sources|degraded_sources)" of relation "retrieval_logs" does not exist/i.test(
    message,
  );
}

function isMissingRetrievalAuditColumnError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /column "(status|error_message)" of relation "retrieval_logs" does not exist/i.test(message);
}

async function insertRetrievalLog(
  sql: ReturnType<typeof getSql>,
  input: RetrievalLogInput,
  mode: "full" | "extended" | "legacy",
): Promise<string> {
  if (mode === "full") {
    const rows = toRows<{ id: string }>(await sql`
      INSERT INTO retrieval_logs (
        firm_id, conversation_id, message_id, query,
        result_chunk_ids, result_document_ids, top_similarity, used_graph_expansion,
        status, error_message, retrieval_scope, result_sources, degraded_sources
      )
      VALUES (
        ${input.firmId ?? null},
        ${input.conversationId ?? null},
        ${input.messageId ?? null},
        ${input.query},
        ${input.resultChunkIds},
        ${input.resultDocumentIds},
        ${input.topSimilarity ?? null},
        ${input.usedGraphExpansion ?? false},
        ${input.status ?? "ok"},
        ${input.errorMessage ?? null},
        ${input.retrievalScope ?? "legal"},
        ${JSON.stringify(input.resultSources ?? [])}::jsonb,
        ${input.degradedSources ?? []}
      )
      RETURNING id
    `);
    return rows[0]!.id;
  }

  if (mode === "extended") {
    const rows = toRows<{ id: string }>(await sql`
      INSERT INTO retrieval_logs (
        firm_id, conversation_id, message_id, query,
        result_chunk_ids, result_document_ids, top_similarity, used_graph_expansion,
        status, error_message
      )
      VALUES (
        ${input.firmId ?? null},
        ${input.conversationId ?? null},
        ${input.messageId ?? null},
        ${input.query},
        ${input.resultChunkIds},
        ${input.resultDocumentIds},
        ${input.topSimilarity ?? null},
        ${input.usedGraphExpansion ?? false},
        ${input.status ?? "ok"},
        ${input.errorMessage ?? null}
      )
      RETURNING id
    `);
    return rows[0]!.id;
  }

  const rows = toRows<{ id: string }>(await sql`
    INSERT INTO retrieval_logs (
      firm_id, conversation_id, message_id, query,
      result_chunk_ids, result_document_ids, top_similarity, used_graph_expansion
    )
    VALUES (
      ${input.firmId ?? null},
      ${input.conversationId ?? null},
      ${input.messageId ?? null},
      ${input.query},
      ${input.resultChunkIds},
      ${input.resultDocumentIds},
      ${input.topSimilarity ?? null},
      ${input.usedGraphExpansion ?? false}
    )
    RETURNING id
  `);
  return rows[0]!.id;
}

export interface LegalChunkRow {
  chunk_id: string;
  parent_unit_id: string;
  document_id: string | null;
  citation: string;
  source_file: string;
  text: string;
  similarity?: number;
  exact_match_score?: number;
}

export class LegalKnowledgeScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LegalKnowledgeScopeError";
  }
}

function requireFirmId(firmId: string | undefined): string {
  if (!firmId) {
    throw new LegalKnowledgeScopeError("firmId is required for legal knowledge retrieval.");
  }
  return firmId;
}

export async function semanticSearchChunks(input: {
  embedding: number[];
  limit: number;
  firmId: string;
}): Promise<LegalChunkRow[]> {
  const firmId = requireFirmId(input.firmId);
  const sql = getSql();
  const embeddingLiteral = `[${input.embedding.join(",")}]`;

  const rows = toRows<LegalChunkRow>(await sql`
    SELECT
      c.chunk_id,
      c.parent_unit_id,
      COALESCE(c.document_id, n.document_id) AS document_id,
      COALESCE(c.metadata->>'citation', n.citation, c.parent_unit_id) AS citation,
      COALESCE(c.metadata->>'source_file', n.payload->>'source_file', n.title, c.document_id, c.parent_unit_id) AS source_file,
      c.chunk_text AS text,
      1 - (c.embedding <=> ${embeddingLiteral}::vector) AS similarity
    FROM legal_unit_chunks c
    JOIN knowledge_nodes n ON n.node_id = c.parent_unit_id
    WHERE c.embedding IS NOT NULL
      AND (c.firm_id IS NULL OR c.firm_id = ${firmId})
    ORDER BY c.embedding <=> ${embeddingLiteral}::vector
    LIMIT ${input.limit}
  `);
  return rows;
}

export async function exactSearchChunks(input: {
  query: string;
  limit: number;
  firmId: string;
}): Promise<LegalChunkRow[]> {
  const firmId = requireFirmId(input.firmId);
  const sql = getSql();
  const pattern = `%${input.query.replace(/%/g, "\\%")}%`;

  const rows = toRows<LegalChunkRow>(await sql`
    SELECT
      c.chunk_id,
      c.parent_unit_id,
      COALESCE(c.document_id, n.document_id) AS document_id,
      COALESCE(c.metadata->>'citation', n.citation, c.parent_unit_id) AS citation,
      COALESCE(c.metadata->>'source_file', n.payload->>'source_file', n.title, c.document_id, c.parent_unit_id) AS source_file,
      c.chunk_text AS text,
      CASE
        WHEN COALESCE(c.metadata->>'citation', n.citation, c.parent_unit_id) ILIKE ${pattern} THEN 1.0
        WHEN c.chunk_text ILIKE ${pattern} THEN 0.8
        ELSE 0.5
      END AS exact_match_score
    FROM legal_unit_chunks c
    JOIN knowledge_nodes n ON n.node_id = c.parent_unit_id
    WHERE (
        COALESCE(c.metadata->>'citation', n.citation, c.parent_unit_id) ILIKE ${pattern}
        OR c.chunk_text ILIKE ${pattern}
        OR c.fts @@ plainto_tsquery('english', ${input.query})
      )
      AND (c.firm_id IS NULL OR c.firm_id = ${firmId})
    ORDER BY exact_match_score DESC
    LIMIT ${input.limit}
  `);
  return rows;
}

export async function relaxedLexicalSearchChunks(input: {
  tsQuery: string;
  limit: number;
  firmId: string;
}): Promise<LegalChunkRow[]> {
  const firmId = requireFirmId(input.firmId);
  const sql = getSql();

  const rows = toRows<LegalChunkRow>(await sql`
    SELECT
      c.chunk_id,
      c.parent_unit_id,
      COALESCE(c.document_id, n.document_id) AS document_id,
      COALESCE(c.metadata->>'citation', n.citation, c.parent_unit_id) AS citation,
      COALESCE(c.metadata->>'source_file', n.payload->>'source_file', n.title, c.document_id, c.parent_unit_id) AS source_file,
      c.chunk_text AS text,
      ts_rank(c.fts, to_tsquery('english', ${input.tsQuery}))::float AS exact_match_score
    FROM legal_unit_chunks c
    JOIN knowledge_nodes n ON n.node_id = c.parent_unit_id
    WHERE c.fts @@ to_tsquery('english', ${input.tsQuery})
      AND (c.firm_id IS NULL OR c.firm_id = ${firmId})
    ORDER BY exact_match_score DESC
    LIMIT ${input.limit}
  `);
  return rows;
}

export async function expandGraphNeighbors(input: {
  chunkIds: string[];
  limit: number;
  firmId: string;
}): Promise<
  Array<LegalChunkRow & { relationship_type?: string; relationship_reason?: string }>
> {
  if (input.chunkIds.length === 0) return [];

  const firmId = requireFirmId(input.firmId);
  const sql = getSql();

  const rows = toRows<
    LegalChunkRow & {
      relationship_type: string | null;
      relationship_reason: string | null;
    }
  >(await sql`
    SELECT DISTINCT ON (c.chunk_id)
      c.chunk_id,
      c.parent_unit_id,
      COALESCE(c.document_id, node.document_id) AS document_id,
      COALESCE(c.metadata->>'citation', node.citation, c.parent_unit_id) AS citation,
      COALESCE(c.metadata->>'source_file', node.payload->>'source_file', node.title, c.document_id, c.parent_unit_id) AS source_file,
      c.chunk_text AS text,
      e.relation AS relationship_type,
      COALESCE(e.notes, e.evidence_quote) AS relationship_reason
    FROM chunk_graph_neighbors n
    JOIN knowledge_edges e ON e.edge_id = n.edge_id
    JOIN legal_unit_chunks c ON c.parent_unit_id = n.neighbor_node_id
    JOIN knowledge_nodes node ON node.node_id = c.parent_unit_id
    WHERE n.chunk_id = ANY(${input.chunkIds}::text[])
      AND (c.firm_id IS NULL OR c.firm_id = ${firmId})
    ORDER BY c.chunk_id, n.relation_weight DESC
    LIMIT ${input.limit}
  `);
  return rows.map((row) => ({
    ...row,
    relationship_type: row.relationship_type ?? undefined,
    relationship_reason: row.relationship_reason ?? undefined,
  }));
}
