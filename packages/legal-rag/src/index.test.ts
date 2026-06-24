import { beforeEach, describe, expect, it, vi } from "vitest";

const logRetrieval = vi.fn().mockResolvedValue("log-1");
const exactSearch = vi.fn();
const semanticSearch = vi.fn();
const expandGraph = vi.fn();
const relaxedLexicalSearch = vi.fn();
const embedQuery = vi.fn();

vi.mock("@leadpilot/db", () => ({
  logRetrieval,
}));

vi.mock("./embeddings.ts", () => ({
  embedQuery,
}));

vi.mock("./search.ts", () => ({
  exactSearch,
  semanticSearch,
  expandGraph,
  relaxedLexicalSearch,
}));

describe("searchLegalKnowledge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    expandGraph.mockResolvedValue([]);
    relaxedLexicalSearch.mockResolvedValue([]);
  });

  it("uses relaxed lexical fallback when exact and semantic matches are empty", async () => {
    exactSearch.mockResolvedValue([]);
    semanticSearch.mockResolvedValue([]);
    embedQuery.mockResolvedValue(null);
    relaxedLexicalSearch.mockResolvedValue([
      {
        chunkId: "relaxed-1",
        parentUnitId: "u1",
        documentId: "d1",
        citation: "CBN Guidelines",
        sourceFile: "cbn.md",
        text: "Fintech licensing",
        exactMatchScore: 0.4,
      },
    ]);

    const { searchLegalKnowledge } = await import("./index.ts");
    const response = await searchLegalKnowledge({
      query: "Nigerian fintech startup regulatory compliance requirements founder agreements",
      firmId: "firm-a",
    });

    expect(response.status).toBe("ok");
    expect(response.results).toHaveLength(1);
    expect(relaxedLexicalSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        tsQuery: "nigerian & fintech & (startup | regulatory | compliance | requirements)",
        firmId: "firm-a",
      }),
    );
  });

  it("logs retrieval failures instead of silently returning empty matches", async () => {
    exactSearch.mockRejectedValue(new Error("database unavailable"));
    embedQuery.mockResolvedValue(null);

    const { searchLegalKnowledge } = await import("./index.ts");
    const response = await searchLegalKnowledge({
      query: "NDPR consent",
      firmId: "firm-a",
      conversationId: "conv-a",
    });

    expect(response.status).toBe("failed");
    expect(response.results).toEqual([]);
    expect(logRetrieval).toHaveBeenCalledWith(
      expect.objectContaining({
        firmId: "firm-a",
        conversationId: "conv-a",
        status: "failed",
        errorMessage: "database unavailable",
        retrievalScope: "legal",
      }),
    );
  });

  it("shouldContinueLoggingLegalScopeForLegalSearch", async () => {
    exactSearch.mockResolvedValueOnce([
      {
        chunkId: "chunk-1",
        parentUnitId: "unit-1",
        documentId: "doc-1",
        citation: "NDPR s.2",
        sourceFile: "ndpr.md",
        text: "Definitions",
      },
    ]);
    embedQuery.mockResolvedValueOnce([0.1, 0.2]);
    semanticSearch.mockResolvedValueOnce([]);

    const { searchLegalKnowledge } = await import("./index.ts");
    await searchLegalKnowledge({
      query: "NDPR consent",
      firmId: "firm-a",
      conversationId: "conv-a",
    });

    expect(logRetrieval).toHaveBeenCalledWith(
      expect.objectContaining({
        retrievalScope: "legal",
        resultSources: [
          expect.objectContaining({ source: "legal", chunkId: "chunk-1" }),
        ],
      }),
    );
  });

  it("shouldDeferChildAuditWhenRequestedByCoordinator", async () => {
    exactSearch.mockResolvedValueOnce([]);
    embedQuery.mockResolvedValueOnce(null);

    const { searchLegalKnowledge } = await import("./index.ts");
    await searchLegalKnowledge({
      query: "NDPR consent",
      firmId: "firm-a",
      auditMode: "deferred",
    });

    expect(logRetrieval).not.toHaveBeenCalled();
  });
});
