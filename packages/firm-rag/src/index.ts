import {
  lexicalSearchFirmKnowledge,
  logRetrieval,
  semanticSearchFirmKnowledge,
  type RetrievalResultSource,
} from "@leadpilot/db";
import { embedQuery, readEmbeddingConfig, readEmbeddingDimensions } from "./embeddings.ts";
import { filterSemanticRowsByFloor, fuseFirmSearchResults, isNamedPersonChunk, isTeamPeopleQuery, parseMinSimilarity, teamPeopleLexicalQuery } from "./search.ts";
import type { AuditMode, FirmSearchInput, FirmSearchResponse } from "./types.ts";

export type { FirmSearchInput, FirmSearchResponse, FirmSearchResult } from "./types.ts";
export type { FirmKnowledgeUploadResult } from "./types.ts";
export { ingestManifest } from "./ingestion.ts";
export { ADMIN_KNOWLEDGE_BASE_SOURCE_KEY, ingestUploadedFirmKnowledgeMarkdown } from "./upload.ts";
export { prepareManifestSource, loadAndValidateManifest } from "./chunking.ts";

async function writeFirmAudit(input: {
  firmId: string;
  conversationId?: string;
  messageId?: string;
  query: string;
  results: FirmSearchResponse["results"];
  status: "ok" | "empty" | "failed";
  degradedSources: string[];
  errorMessage?: string;
}) {
  const resultSources: RetrievalResultSource[] = input.results.map((result, index) => ({
    source: "firm",
    chunkId: result.chunkId,
    documentId: result.documentId,
    rank: index + 1,
  }));

  try {
    await logRetrieval({
      firmId: input.firmId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      query: input.query,
      resultChunkIds: resultSources.map((source) => source.chunkId),
      resultDocumentIds: [...new Set(resultSources.map((source) => source.documentId))],
      topSimilarity: input.results[0]?.similarity,
      status: input.status,
      errorMessage: input.errorMessage,
      retrievalScope: "firm",
      resultSources,
      degradedSources: input.degradedSources,
    });
  } catch {
    // Audit logging must not mask retrieval output.
  }
}

export async function searchFirmKnowledge(input: FirmSearchInput): Promise<FirmSearchResponse> {
  if (!input.firmId) {
    return {
      status: "failed",
      results: [],
      degradedSources: [],
      errorMessage: "firmId is required for firm knowledge retrieval.",
    };
  }

  const auditMode: AuditMode = input.auditMode ?? "standalone";
  const limit = input.limit ?? 6;
  const degradedSources: string[] = [];

  try {
    const minSimilarity = parseMinSimilarity();
    const embeddingDimensions = readEmbeddingDimensions();
    if (embeddingDimensions === null) {
      degradedSources.push("semantic", "embedding_dimensions_unsupported");
    }
    const embeddingConfig =
      embeddingDimensions === null ? null : readEmbeddingConfig();
    const embeddingModel =
      embeddingConfig?.model ?? process.env.FIRM_KB_EMBEDDING_MODEL ?? "text-embedding-3-small";

    let semanticRows: Awaited<ReturnType<typeof semanticSearchFirmKnowledge>>["rows"] = [];
    if (embeddingConfig && embeddingDimensions === 1536) {
      try {
        const embedding = await embedQuery(input.query, embeddingConfig);
        const semantic = await semanticSearchFirmKnowledge({
          firmId: input.firmId,
          embedding,
          embeddingModel,
          embeddingDimensions: 1536,
          limit,
          minSimilarity,
        });
        if (semantic.fingerprintStatus === "mismatch") {
          degradedSources.push("semantic", "embedding_fingerprint_mismatch");
        } else {
          semanticRows = semantic.rows;
        }
      } catch {
        degradedSources.push("semantic");
      }
    } else {
      degradedSources.push("semantic");
    }

    const lexicalRows = await lexicalSearchFirmKnowledge({
      firmId: input.firmId,
      query: input.query,
      limit,
    });

    let mergedLexicalRows = lexicalRows;
    if (isTeamPeopleQuery(input.query)) {
      const peopleLexicalRows = await lexicalSearchFirmKnowledge({
        firmId: input.firmId,
        query: teamPeopleLexicalQuery(input.query),
        limit: limit * 3,
      });
      const byChunkId = new Map(mergedLexicalRows.map((row) => [row.chunk_id, row]));
      for (const row of peopleLexicalRows) {
        if (isNamedPersonChunk(row) && !byChunkId.has(row.chunk_id)) {
          byChunkId.set(row.chunk_id, row);
        }
      }
      mergedLexicalRows = [...byChunkId.values()];
    }

    const filteredSemantic = filterSemanticRowsByFloor(semanticRows, minSimilarity, mergedLexicalRows);
    const fused = fuseFirmSearchResults({
      query: input.query,
      semanticRows: filteredSemantic,
      lexicalRows: mergedLexicalRows,
      limit,
    });

    const status = fused.length === 0 ? "empty" : "ok";
    const response: FirmSearchResponse = {
      status,
      results: fused,
      degradedSources,
      internalResultIds: fused.map((result, index) => ({
        source: "firm",
        chunkId: result.chunkId,
        documentId: result.documentId,
        rank: index + 1,
      })),
    };

    if (auditMode === "standalone") {
      await writeFirmAudit({
        firmId: input.firmId,
        conversationId: input.conversationId,
        messageId: input.messageId,
        query: input.query,
        results: fused,
        status,
        degradedSources,
      });
    }

    return response;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Firm knowledge retrieval failed.";
    const response: FirmSearchResponse = {
      status: "failed",
      results: [],
      degradedSources,
      errorMessage,
    };

    if (auditMode === "standalone") {
      await writeFirmAudit({
        firmId: input.firmId,
        conversationId: input.conversationId,
        messageId: input.messageId,
        query: input.query,
        results: [],
        status: "failed",
        degradedSources,
        errorMessage,
      });
    }

    return response;
  }
}
