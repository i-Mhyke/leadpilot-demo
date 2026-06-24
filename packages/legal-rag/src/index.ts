import { logRetrieval } from "@leadpilot/db";
import { embedQuery } from "./embeddings.ts";
import { exactSearch, expandGraph, relaxedLexicalSearch, semanticSearch } from "./search.ts";
import { buildRelaxedTsQuery, extractSearchTerms } from "./query-terms.ts";
import { rankLegalResults } from "./rank.ts";
import type { LegalSearchInput, LegalSearchResponse } from "./types.ts";

export type { LegalSearchInput, LegalSearchResponse, LegalSearchResult } from "./types.ts";

async function writeRetrievalLog(input: {
  firmId: string;
  conversationId?: string;
  messageId?: string;
  query: string;
  results: Array<{ chunkId: string; documentId: string; similarity?: number }>;
  usedGraphExpansion: boolean;
  status: "ok" | "empty" | "failed";
  errorMessage?: string;
  auditMode?: "standalone" | "deferred";
}) {
  if (input.auditMode === "deferred") {
    return;
  }

  try {
    await logRetrieval({
      firmId: input.firmId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      query: input.query,
      resultChunkIds: input.results.map((result) => result.chunkId),
      resultDocumentIds: [...new Set(input.results.map((result) => result.documentId))],
      topSimilarity: input.results[0]?.similarity,
      usedGraphExpansion: input.usedGraphExpansion,
      status: input.status,
      errorMessage: input.errorMessage,
      retrievalScope: "legal",
      resultSources: input.results.map((result, index) => ({
        source: "legal" as const,
        chunkId: result.chunkId,
        documentId: result.documentId,
        rank: index + 1,
      })),
    });
  } catch {
    // Audit logging must not mask the retrieval response.
  }
}

export async function searchLegalKnowledge(input: LegalSearchInput): Promise<LegalSearchResponse> {
  if (!input.firmId) {
    return {
      status: "failed",
      results: [],
      errorMessage: "firmId is required for legal knowledge retrieval.",
    };
  }

  const limit = input.limit ?? 6;
  const graphDepth = input.graphDepth ?? 1;

  try {
    const [exactResults, embedding] = await Promise.all([
      exactSearch({ query: input.query, limit, firmId: input.firmId }),
      embedQuery(input.query),
    ]);

    const semanticResults = embedding
      ? await semanticSearch({ queryEmbedding: embedding, limit, firmId: input.firmId })
      : [];

    let lexicalResults = exactResults;
    if (lexicalResults.length === 0 && semanticResults.length === 0) {
      const tsQuery = buildRelaxedTsQuery(extractSearchTerms(input.query));
      if (tsQuery) {
        lexicalResults = await relaxedLexicalSearch({
          tsQuery,
          limit,
          firmId: input.firmId,
        });
      }
    }

    const seedIds = [...lexicalResults, ...semanticResults].map((result) => result.chunkId);
    const graphResults =
      graphDepth > 0 && seedIds.length > 0
        ? await expandGraph({
            chunkIds: seedIds,
            limit: Math.max(3, Math.floor(limit / 2)),
            firmId: input.firmId,
          })
        : [];

    const ranked = rankLegalResults({
      semanticResults,
      exactResults: lexicalResults,
      graphResults,
      limit,
    });

    const status = ranked.length === 0 ? "empty" : "ok";
    await writeRetrievalLog({
      firmId: input.firmId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      query: input.query,
      results: ranked,
      usedGraphExpansion: graphResults.length > 0,
      status,
      auditMode: input.auditMode,
    });

    return { status, results: ranked };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Legal knowledge retrieval failed.";
    await writeRetrievalLog({
      firmId: input.firmId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      query: input.query,
      results: [],
      usedGraphExpansion: false,
      status: "failed",
      errorMessage,
      auditMode: input.auditMode,
    });

    return {
      status: "failed",
      results: [],
      errorMessage,
    };
  }
}
