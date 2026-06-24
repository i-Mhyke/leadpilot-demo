import { getSql } from "./client.ts";
import { rows as toRows } from "./sql.ts";

export class FirmKnowledgeScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FirmKnowledgeScopeError";
  }
}

export interface FirmKnowledgeChunkRow {
  chunk_id: string;
  document_id: string;
  source_key: string;
  title: string;
  source_uri: string | null;
  heading_path: string[];
  content_type: string;
  text: string;
  metadata: Record<string, unknown>;
  similarity?: number;
  lexical_rank?: number;
}

function requireFirmId(firmId: string | undefined): string {
  if (!firmId) {
    throw new FirmKnowledgeScopeError("firmId is required for firm knowledge retrieval.");
  }
  return firmId;
}

export async function semanticSearchFirmKnowledge(input: {
  firmId: string;
  embedding: number[];
  embeddingModel: string;
  embeddingDimensions: 1536;
  limit: number;
  minSimilarity: number;
}): Promise<{
  rows: FirmKnowledgeChunkRow[];
  fingerprintStatus: "matched" | "mismatch" | "no_published_document";
}> {
  const firmId = requireFirmId(input.firmId);
  const sql = getSql();
  const embeddingLiteral = `[${input.embedding.join(",")}]`;

  const publishedCount = toRows<{ count: string }>(await sql`
    SELECT COUNT(*)::text AS count
    FROM firm_knowledge_documents d
    WHERE d.firm_id = ${firmId}
      AND d.status = 'published'
  `);
  const hasPublished = Number(publishedCount[0]?.count ?? 0) > 0;

  const fingerprintCount = toRows<{ count: string }>(await sql`
    SELECT COUNT(*)::text AS count
    FROM firm_knowledge_documents d
    WHERE d.firm_id = ${firmId}
      AND d.status = 'published'
      AND d.embedding_model = ${input.embeddingModel}
      AND d.embedding_dimensions = ${input.embeddingDimensions}
  `);
  const fingerprintMatches = Number(fingerprintCount[0]?.count ?? 0) > 0;

  let fingerprintStatus: "matched" | "mismatch" | "no_published_document";
  if (!hasPublished) {
    fingerprintStatus = "no_published_document";
  } else if (!fingerprintMatches) {
    fingerprintStatus = "mismatch";
  } else {
    fingerprintStatus = "matched";
  }

  if (fingerprintStatus !== "matched") {
    return { rows: [], fingerprintStatus };
  }

  const rows = toRows<FirmKnowledgeChunkRow>(await sql`
    SELECT
      c.id AS chunk_id,
      c.document_id,
      d.source_key,
      d.title,
      d.source_uri,
      c.heading_path,
      c.content_type,
      c.chunk_text AS text,
      c.metadata,
      1 - (c.embedding <=> ${embeddingLiteral}::vector) AS similarity
    FROM firm_knowledge_chunks c
    JOIN firm_knowledge_documents d
      ON d.id = c.document_id AND d.firm_id = c.firm_id
    WHERE c.firm_id = ${firmId}
      AND d.status = 'published'
      AND d.embedding_model = ${input.embeddingModel}
      AND d.embedding_dimensions = ${input.embeddingDimensions}
      AND c.embedding IS NOT NULL
      AND 1 - (c.embedding <=> ${embeddingLiteral}::vector) >= ${input.minSimilarity}
    ORDER BY c.embedding <=> ${embeddingLiteral}::vector
    LIMIT ${input.limit}
  `);

  return { rows, fingerprintStatus };
}

export async function lexicalSearchFirmKnowledge(input: {
  firmId: string;
  query: string;
  limit: number;
}): Promise<FirmKnowledgeChunkRow[]> {
  const firmId = requireFirmId(input.firmId);
  const sql = getSql();

  const rows = toRows<FirmKnowledgeChunkRow>(await sql`
    SELECT
      c.id AS chunk_id,
      c.document_id,
      d.source_key,
      d.title,
      d.source_uri,
      c.heading_path,
      c.content_type,
      c.chunk_text AS text,
      c.metadata,
      ts_rank(c.fts, plainto_tsquery('english', ${input.query}))::float AS lexical_rank
    FROM firm_knowledge_chunks c
    JOIN firm_knowledge_documents d
      ON d.id = c.document_id AND d.firm_id = c.firm_id
    WHERE c.firm_id = ${firmId}
      AND d.status = 'published'
      AND c.fts @@ plainto_tsquery('english', ${input.query})
    ORDER BY lexical_rank DESC
    LIMIT ${input.limit}
  `);

  return rows;
}

export async function createOrReuseFirmKnowledgeDraft(input: {
  firmId: string;
  sourceKey: string;
  title: string;
  sourceType: string;
  sourceUri?: string;
  contentMarkdown: string;
  contentHash: string;
  expectedChunkCount: number;
  embeddingModel: string;
  embeddingDimensions: 1536;
  effectiveAt?: string;
  metadata: Record<string, unknown>;
}): Promise<{
  documentId: string;
  version: number;
  state: "unchanged_published" | "resumable_draft" | "archived_match" | "created_draft";
}> {
  const sql = getSql();
  const rows = toRows<{ document_id: string; version: number; state: string }>(await sql`
    SELECT document_id, version, state
    FROM resolve_firm_knowledge_draft(
      ${input.firmId}::uuid,
      ${input.sourceKey},
      ${input.title},
      ${input.sourceType},
      ${input.sourceUri ?? null},
      ${input.contentMarkdown},
      ${input.contentHash},
      ${input.expectedChunkCount},
      ${input.embeddingModel},
      ${input.embeddingDimensions},
      ${input.effectiveAt ?? null}::timestamptz,
      ${JSON.stringify(input.metadata)}::jsonb
    )
  `);
  const row = rows[0];
  if (!row) {
    throw new Error("resolve_firm_knowledge_draft returned no rows");
  }
  return {
    documentId: row.document_id,
    version: row.version,
    state: row.state as "unchanged_published" | "resumable_draft" | "archived_match" | "created_draft",
  };
}

export async function replaceFirmKnowledgeDraftChunks(input: {
  firmId: string;
  documentId: string;
  chunks: Array<Record<string, unknown>>;
}): Promise<void> {
  const sql = getSql();
  await sql`
    SELECT replace_firm_knowledge_draft_chunks(
      ${input.firmId}::uuid,
      ${input.documentId}::uuid,
      ${JSON.stringify(input.chunks)}::jsonb
    )
  `;
}

export async function publishFirmKnowledgeDraft(input: {
  firmId: string;
  documentId: string;
  sourceKey: string;
}): Promise<"published" | "superseded"> {
  const sql = getSql();
  const rows = toRows<{ publish_firm_knowledge_draft: string }>(await sql`
    SELECT publish_firm_knowledge_draft(
      ${input.firmId}::uuid,
      ${input.documentId}::uuid,
      ${input.sourceKey}
    )
  `);
  const result = rows[0]?.publish_firm_knowledge_draft;
  if (result !== "published" && result !== "superseded") {
    throw new Error(`Unexpected publish result: ${result ?? "null"}`);
  }
  return result;
}

export async function restoreArchivedFirmKnowledgeDocument(input: {
  firmId: string;
  documentId: string;
  sourceKey: string;
  embeddingModel: string;
  embeddingDimensions: 1536;
}): Promise<void> {
  const sql = getSql();
  await sql`
    SELECT restore_archived_firm_knowledge_document(
      ${input.firmId}::uuid,
      ${input.documentId}::uuid,
      ${input.sourceKey},
      ${input.embeddingModel},
      ${input.embeddingDimensions}
    )
  `;
}
