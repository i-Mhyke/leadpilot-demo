import { beforeEach, describe, expect, it, vi } from "vitest";
import { setSqlForTests } from "./client.ts";
import {
  FirmKnowledgeScopeError,
  createOrReuseFirmKnowledgeDraft,
  lexicalSearchFirmKnowledge,
  publishFirmKnowledgeDraft,
  replaceFirmKnowledgeDraftChunks,
  restoreArchivedFirmKnowledgeDocument,
  semanticSearchFirmKnowledge,
} from "./firm-knowledge.ts";

describe("firm knowledge tenant scoping", () => {
  beforeEach(() => {
    setSqlForTests(null);
  });

  it("shouldRequireFirmIdForFirmSemanticSearch", async () => {
    await expect(
      semanticSearchFirmKnowledge({
        firmId: "",
        embedding: [0.1],
        embeddingModel: "text-embedding-3-small",
        embeddingDimensions: 1536,
        limit: 3,
        minSimilarity: 0.45,
      }),
    ).rejects.toBeInstanceOf(FirmKnowledgeScopeError);
  });

  it("shouldScopeFirmLexicalSearchByFirmAndPublishedStatus", async () => {
    const sql = vi.fn().mockResolvedValueOnce([]);
    setSqlForTests(sql as never);

    await lexicalSearchFirmKnowledge({
      firmId: "firm-a",
      query: "data protection",
      limit: 6,
    });

    const query = String(sql.mock.calls[0]?.[0]);
    expect(query).toContain("c.firm_id =");
    expect(query).toContain("d.status = 'published'");
  });

  it("shouldNotReturnChunksOwnedByAnotherFirm", async () => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([{ count: "1" }])
      .mockResolvedValueOnce([{ count: "1" }])
      .mockResolvedValueOnce([]);
    setSqlForTests(sql as never);

    await semanticSearchFirmKnowledge({
      firmId: "firm-b",
      embedding: [0.1],
      embeddingModel: "text-embedding-3-small",
      embeddingDimensions: 1536,
      limit: 3,
      minSimilarity: 0.45,
    });

    const fingerprintQuery = String(sql.mock.calls[1]?.[0]);
    const searchQuery = String(sql.mock.calls[2]?.[0]);
    expect(fingerprintQuery).toContain("d.firm_id =");
    expect(searchQuery).toContain("c.firm_id =");
    expect(sql.mock.calls[1]?.slice(1)).toContain("firm-b");
    expect(sql.mock.calls[2]?.slice(1)).toContain("firm-b");
  });

  it("shouldNotSearchDraftOrArchivedDocumentVersions", async () => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([{ count: "1" }])
      .mockResolvedValueOnce([{ count: "1" }])
      .mockResolvedValueOnce([]);
    setSqlForTests(sql as never);

    await semanticSearchFirmKnowledge({
      firmId: "firm-a",
      embedding: [0.1],
      embeddingModel: "text-embedding-3-small",
      embeddingDimensions: 1536,
      limit: 3,
      minSimilarity: 0.45,
    });

    const searchQuery = String(sql.mock.calls[2]?.[0]);
    expect(searchQuery).toContain("d.status = 'published'");
    expect(searchQuery).not.toContain("draft");
    expect(searchQuery).not.toContain("archived");
  });

  it("shouldNotAttachChunkToAnotherFirmDocument", async () => {
    const sql = vi.fn().mockResolvedValueOnce(undefined);
    setSqlForTests(sql as never);

    await replaceFirmKnowledgeDraftChunks({
      firmId: "firm-a",
      documentId: "doc-1",
      chunks: [
        {
          id: "chunk-1",
          chunkIndex: 1,
          chunkCount: 1,
          headingPath: [],
          contentType: "overview",
          chunkText: "text",
          textHash: "hash",
          estimatedTokens: 10,
          embedding: "[0.1]",
          embeddingModel: "text-embedding-3-small",
          embeddingDimensions: 1536,
          embeddedAt: "2026-06-19T00:00:00.000Z",
          metadata: {},
        },
      ],
    });

    const query = String(sql.mock.calls[0]?.[0]);
    expect(query).toContain("replace_firm_knowledge_draft_chunks");
    expect(sql.mock.calls[0]?.slice(1)).toContain("firm-a");
  });
});

describe("firm knowledge publication lifecycle", () => {
  beforeEach(() => {
    setSqlForTests(null);
  });

  it("shouldNotCreateDuplicateVersionForSameContentHashAndFingerprint", async () => {
    const sql = vi.fn().mockResolvedValueOnce([
      { document_id: "doc-1", version: 1, state: "unchanged_published" },
    ]);
    setSqlForTests(sql as never);

    const result = await createOrReuseFirmKnowledgeDraft({
      firmId: "firm-a",
      sourceKey: "website-company-profile",
      title: "Profile",
      sourceType: "website",
      contentMarkdown: "# Firm",
      contentHash: "hash-1",
      expectedChunkCount: 2,
      embeddingModel: "text-embedding-3-small",
      embeddingDimensions: 1536,
      metadata: {},
    });

    expect(result.state).toBe("unchanged_published");
    expect(String(sql.mock.calls[0]?.[0])).toContain("resolve_firm_knowledge_draft");
  });

  it("shouldResolvePublishedHashAsUnchangedNoOp", async () => {
    const sql = vi.fn().mockResolvedValueOnce([
      { document_id: "doc-1", version: 1, state: "unchanged_published" },
    ]);
    setSqlForTests(sql as never);

    const result = await createOrReuseFirmKnowledgeDraft({
      firmId: "firm-a",
      sourceKey: "website-company-profile",
      title: "Profile",
      sourceType: "website",
      contentMarkdown: "# Firm",
      contentHash: "hash-1",
      expectedChunkCount: 2,
      embeddingModel: "text-embedding-3-small",
      embeddingDimensions: 1536,
      metadata: {},
    });

    expect(result.state).toBe("unchanged_published");
  });

  it("shouldResolveDraftHashAsResumableDraft", async () => {
    const sql = vi.fn().mockResolvedValueOnce([
      { document_id: "doc-2", version: 2, state: "resumable_draft" },
    ]);
    setSqlForTests(sql as never);

    const result = await createOrReuseFirmKnowledgeDraft({
      firmId: "firm-a",
      sourceKey: "website-company-profile",
      title: "Profile",
      sourceType: "website",
      contentMarkdown: "# Firm",
      contentHash: "hash-2",
      expectedChunkCount: 2,
      embeddingModel: "text-embedding-3-small",
      embeddingDimensions: 1536,
      metadata: {},
    });

    expect(result.state).toBe("resumable_draft");
  });

  it("shouldResolveArchivedHashAsExplicitRestoreOnly", async () => {
    const sql = vi.fn().mockResolvedValueOnce([
      { document_id: "doc-3", version: 1, state: "archived_match" },
    ]);
    setSqlForTests(sql as never);

    const result = await createOrReuseFirmKnowledgeDraft({
      firmId: "firm-a",
      sourceKey: "website-company-profile",
      title: "Profile",
      sourceType: "website",
      contentMarkdown: "# Firm",
      contentHash: "hash-1",
      expectedChunkCount: 2,
      embeddingModel: "text-embedding-3-small",
      embeddingDimensions: 1536,
      metadata: {},
    });

    expect(result.state).toBe("archived_match");
  });

  it("shouldCreateNewDraftWhenEmbeddingFingerprintChanges", async () => {
    const sql = vi.fn().mockResolvedValueOnce([
      { document_id: "doc-4", version: 3, state: "created_draft" },
    ]);
    setSqlForTests(sql as never);

    const result = await createOrReuseFirmKnowledgeDraft({
      firmId: "firm-a",
      sourceKey: "website-company-profile",
      title: "Profile",
      sourceType: "website",
      contentMarkdown: "# Firm",
      contentHash: "hash-1",
      expectedChunkCount: 2,
      embeddingModel: "text-embedding-3-large",
      embeddingDimensions: 1536,
      metadata: {},
    });

    expect(result.state).toBe("created_draft");
    expect(result.version).toBe(3);
  });

  it("shouldNotMutatePublishedOrArchivedChunks", async () => {
    const sql = vi
      .fn()
      .mockRejectedValueOnce(new Error("FIRM_KB_NOT_DRAFT"));
    setSqlForTests(sql as never);

    await expect(
      replaceFirmKnowledgeDraftChunks({
        firmId: "firm-a",
        documentId: "doc-published",
        chunks: [],
      }),
    ).rejects.toThrow("FIRM_KB_NOT_DRAFT");
  });

  it("shouldSerializeConcurrentVersionAllocationPerSource", async () => {
    const sql = vi.fn().mockResolvedValueOnce([
      { document_id: "doc-5", version: 2, state: "created_draft" },
    ]);
    setSqlForTests(sql as never);

    await createOrReuseFirmKnowledgeDraft({
      firmId: "firm-a",
      sourceKey: "website-company-profile",
      title: "Profile",
      sourceType: "website",
      contentMarkdown: "# Firm",
      contentHash: "hash-new",
      expectedChunkCount: 2,
      embeddingModel: "text-embedding-3-small",
      embeddingDimensions: 1536,
      metadata: {},
    });

    expect(String(sql.mock.calls[0]?.[0])).toContain("resolve_firm_knowledge_draft");
  });

  it("shouldPublishNewVersionAndArchivePreviousVersionAtomically", async () => {
    const sql = vi.fn().mockResolvedValueOnce([{ publish_firm_knowledge_draft: "published" }]);
    setSqlForTests(sql as never);

    const result = await publishFirmKnowledgeDraft({
      firmId: "firm-a",
      documentId: "doc-draft",
      sourceKey: "website-company-profile",
    });

    expect(result).toBe("published");
    expect(String(sql.mock.calls[0]?.[0])).toContain("publish_firm_knowledge_draft");
  });

  it("shouldNotPublishIncompleteOrNonContiguousChunkSet", async () => {
    const sql = vi
      .fn()
      .mockRejectedValueOnce(new Error("FIRM_KB_INCOMPLETE_CHUNKS"));
    setSqlForTests(sql as never);

    await expect(
      publishFirmKnowledgeDraft({
        firmId: "firm-a",
        documentId: "doc-draft",
        sourceKey: "website-company-profile",
      }),
    ).rejects.toThrow("FIRM_KB_INCOMPLETE_CHUNKS");
  });

  it("shouldNotPublishSupersededDraft", async () => {
    const sql = vi.fn().mockResolvedValueOnce([{ publish_firm_knowledge_draft: "superseded" }]);
    setSqlForTests(sql as never);

    const result = await publishFirmKnowledgeDraft({
      firmId: "firm-a",
      documentId: "old-draft",
      sourceKey: "website-company-profile",
    });

    expect(result).toBe("superseded");
  });

  it("shouldRestoreCompleteArchivedVersionAtomically", async () => {
    const sql = vi.fn().mockResolvedValueOnce([]);
    setSqlForTests(sql as never);

    await restoreArchivedFirmKnowledgeDocument({
      firmId: "firm-a",
      documentId: "doc-archived",
      sourceKey: "website-company-profile",
      embeddingModel: "text-embedding-3-small",
      embeddingDimensions: 1536,
    });

    expect(String(sql.mock.calls[0]?.[0])).toContain("restore_archived_firm_knowledge_document");
  });
});
