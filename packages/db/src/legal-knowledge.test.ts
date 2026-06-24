import { describe, expect, it, vi, beforeEach } from "vitest";
import { setSqlForTests } from "./client.ts";
import {
  LegalKnowledgeScopeError,
  exactSearchChunks,
  expandGraphNeighbors,
  logRetrieval,
  semanticSearchChunks,
} from "./legal-knowledge.ts";

describe("legal knowledge firm scoping", () => {
  it("requires firmId before querying chunks", async () => {
    await expect(
      semanticSearchChunks({
        embedding: [0.1, 0.2],
        limit: 3,
        firmId: "",
      }),
    ).rejects.toBeInstanceOf(LegalKnowledgeScopeError);
  });

  it("queries semantic chunks using the ingestion schema column names", async () => {
    const sql = vi.fn().mockResolvedValueOnce([
      {
        chunk_id: "ng:test:unit-0001:chunk-0001",
        parent_unit_id: "ng:test:unit-0001",
        document_id: "doc-1",
        citation: "Test citation",
        source_file: "test.md",
        text: "Test text",
        similarity: 0.9,
      },
    ]);
    setSqlForTests(sql as never);

    const rows = await semanticSearchChunks({
      embedding: [0.1, 0.2],
      limit: 3,
      firmId: "firm-a",
    });

    const query = String(sql.mock.calls[0]?.[0]);
    expect(query).toContain("c.chunk_id");
    expect(query).toContain("c.chunk_text AS text");
    expect(query).toContain("JOIN knowledge_nodes");
    expect(query).not.toContain("c.id");
    expect(rows[0]?.chunk_id).toBe("ng:test:unit-0001:chunk-0001");
  });

  it("queries exact chunks using chunk_text and generated full-text search", async () => {
    const sql = vi.fn().mockResolvedValueOnce([]);
    setSqlForTests(sql as never);

    await exactSearchChunks({
      query: "co-founder agreement Nigeria",
      limit: 6,
      firmId: "firm-a",
    });

    const query = String(sql.mock.calls[0]?.[0]);
    expect(query).toContain("c.chunk_id");
    expect(query).toContain("c.chunk_text");
    expect(query).toContain("c.fts @@ plainto_tsquery");
    expect(query).not.toContain("c.text");
    expect(query).not.toContain("c.citation");
  });

  it("expands graph neighbors using chunk_id and neighbor_node_id", async () => {
    const sql = vi.fn().mockResolvedValueOnce([]);
    setSqlForTests(sql as never);

    await expandGraphNeighbors({
      chunkIds: ["ng:test:unit-0001:chunk-0001"],
      limit: 3,
      firmId: "firm-a",
    });

    const query = String(sql.mock.calls[0]?.[0]);
    expect(query).toContain("n.chunk_id");
    expect(query).toContain("e.edge_id");
    expect(query).toContain("c.parent_unit_id = n.neighbor_node_id");
    expect(query).not.toContain("n.source_chunk_id");
    expect(query).not.toContain("n.neighbor_chunk_id");
    expect(query).not.toContain("e.id");
  });
});

describe("retrieval logging compatibility", () => {
  beforeEach(() => {
    setSqlForTests(null);
  });

  it("falls back to legacy retrieval_logs insert when audit columns are missing", async () => {
    const sql = vi
      .fn()
      .mockRejectedValueOnce(
        new Error('column "retrieval_scope" of relation "retrieval_logs" does not exist'),
      )
      .mockRejectedValueOnce(
        new Error('column "status" of relation "retrieval_logs" does not exist'),
      )
      .mockResolvedValueOnce([{ id: "log-legacy" }]);
    setSqlForTests(sql as never);

    const id = await logRetrieval({
      firmId: "firm-a",
      query: "NDPR consent",
      resultChunkIds: [],
      resultDocumentIds: [],
      status: "failed",
      errorMessage: "database unavailable",
    });

    expect(id).toBe("log-legacy");
    expect(sql).toHaveBeenCalledTimes(3);
  });

  it("shouldKeepLegacyRetrievalRowsReadableWithoutNewCallerFields", async () => {
    const sql = vi.fn().mockResolvedValueOnce([{ id: "log-full" }]);
    setSqlForTests(sql as never);

    await logRetrieval({
      firmId: "firm-a",
      query: "NDPR consent",
      resultChunkIds: ["chunk-1"],
      resultDocumentIds: ["doc-1"],
    });

    const query = String(sql.mock.calls[0]?.[0]);
    expect(query).toContain("retrieval_scope");
    const values = sql.mock.calls[0]?.slice(1) ?? [];
    expect(values).toContain("legal");
  });
});
