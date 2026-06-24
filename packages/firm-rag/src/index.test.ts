import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FirmKnowledgeChunkRow } from "@leadpilot/db";

const semanticSearchFirmKnowledge = vi.fn();
const lexicalSearchFirmKnowledge = vi.fn();
const logRetrieval = vi.fn();
const embedQuery = vi.fn();

vi.mock("@leadpilot/db", () => ({
  semanticSearchFirmKnowledge,
  lexicalSearchFirmKnowledge,
  logRetrieval,
}));

vi.mock("./embeddings.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./embeddings.ts")>();
  return {
    ...actual,
    embedQuery,
    readEmbeddingConfig: () => ({
      apiKey: "test",
      model: "text-embedding-3-small",
      dimensions: 1536 as const,
      batchSize: 96,
    }),
  };
});

function row(partial: Partial<FirmKnowledgeChunkRow> & { chunk_id: string }): FirmKnowledgeChunkRow {
  return {
    document_id: "doc-1",
    source_key: "website-company-profile",
    title: "Profile",
    source_uri: null,
    heading_path: [],
    content_type: "overview",
    text: "sample",
    metadata: {},
    ...partial,
  };
}

describe("searchFirmKnowledge", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.FIRM_KB_EMBEDDING_DIMENSIONS = "1536";
    process.env.OPENAI_API_KEY = "test-key";
    semanticSearchFirmKnowledge.mockResolvedValue({ rows: [], fingerprintStatus: "matched" });
    lexicalSearchFirmKnowledge.mockResolvedValue([]);
    embedQuery.mockResolvedValue([0.1, 0.2]);
    logRetrieval.mockResolvedValue("log-1");
  });

  it("shouldRequireFirmIdBeforeSearch", async () => {
    const { searchFirmKnowledge } = await import("./index.ts");
    const response = await searchFirmKnowledge({ query: "mission", firmId: "" });
    expect(response.status).toBe("failed");
  });

  it("shouldSearchOnlyPublishedChunksForBoundFirm", async () => {
    const { searchFirmKnowledge } = await import("./index.ts");
    await searchFirmKnowledge({ query: "mission", firmId: "firm-a" });
    expect(semanticSearchFirmKnowledge).toHaveBeenCalledWith(
      expect.objectContaining({ firmId: "firm-a" }),
    );
    expect(lexicalSearchFirmKnowledge).toHaveBeenCalledWith(
      expect.objectContaining({ firmId: "firm-a" }),
    );
  });

  it("shouldUseLexicalResultsWhenEmbeddingProviderFails", async () => {
    embedQuery.mockRejectedValueOnce(new Error("timeout"));
    lexicalSearchFirmKnowledge.mockResolvedValueOnce([
      row({ chunk_id: "lex-1", text: "lexical only" }),
    ]);
    const { searchFirmKnowledge } = await import("./index.ts");
    const response = await searchFirmKnowledge({ query: "mission", firmId: "firm-a" });
    expect(response.status).toBe("ok");
    expect(response.degradedSources).toContain("semantic");
    expect(response.results[0]?.chunkId).toBe("lex-1");
  });

  it("shouldReturnFailedWhenDatabaseSearchFails", async () => {
    lexicalSearchFirmKnowledge.mockRejectedValueOnce(new Error("database unavailable"));
    const { searchFirmKnowledge } = await import("./index.ts");
    const response = await searchFirmKnowledge({ query: "mission", firmId: "firm-a" });
    expect(response.status).toBe("failed");
  });

  it("shouldNotCompareQueryVectorAgainstDifferentEmbeddingFingerprint", async () => {
    semanticSearchFirmKnowledge.mockResolvedValueOnce({
      rows: [],
      fingerprintStatus: "mismatch",
    });
    lexicalSearchFirmKnowledge.mockResolvedValueOnce([row({ chunk_id: "lex-1" })]);
    const { searchFirmKnowledge } = await import("./index.ts");
    const response = await searchFirmKnowledge({ query: "mission", firmId: "firm-a" });
    expect(response.degradedSources).toContain("embedding_fingerprint_mismatch");
    expect(response.results).toHaveLength(1);
  });

  it("shouldLogFirmScopeAndSourceLabels", async () => {
    semanticSearchFirmKnowledge.mockResolvedValueOnce({
      rows: [row({ chunk_id: "chunk-1", similarity: 0.9 })],
      fingerprintStatus: "matched",
    });
    const { searchFirmKnowledge } = await import("./index.ts");
    await searchFirmKnowledge({
      query: "mission",
      firmId: "firm-a",
      conversationId: "conv-a",
    });
    expect(logRetrieval).toHaveBeenCalledWith(
      expect.objectContaining({
        retrievalScope: "firm",
        resultSources: [
          expect.objectContaining({ source: "firm", chunkId: "chunk-1", documentId: "doc-1" }),
        ],
      }),
    );
  });

  it("shouldDeferChildAuditWhenRequestedByCoordinator", async () => {
    const { searchFirmKnowledge } = await import("./index.ts");
    await searchFirmKnowledge({
      query: "mission",
      firmId: "firm-a",
      auditMode: "deferred",
    });
    expect(logRetrieval).not.toHaveBeenCalled();
  });

  it("shouldRejectConfiguredDimensionsOtherThan1536BeforeRemoteCalls", async () => {
    process.env.FIRM_KB_EMBEDDING_DIMENSIONS = "3072";
    process.env.OPENAI_API_KEY = "test-key";
    vi.resetModules();
    lexicalSearchFirmKnowledge.mockResolvedValueOnce([
      row({ chunk_id: "lex-1", text: "lexical fallback" }),
    ]);
    const { searchFirmKnowledge } = await import("./index.ts");
    const response = await searchFirmKnowledge({ query: "mission", firmId: "firm-a" });
    expect(embedQuery).not.toHaveBeenCalled();
    expect(response.degradedSources).toContain("embedding_dimensions_unsupported");
    expect(response.status).toBe("ok");
    process.env.FIRM_KB_EMBEDDING_DIMENSIONS = "1536";
  });
});
