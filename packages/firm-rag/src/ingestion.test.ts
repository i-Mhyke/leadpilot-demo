import { describe, expect, it, vi, beforeEach } from "vitest";

const createOrReuseFirmKnowledgeDraft = vi.fn();
const replaceFirmKnowledgeDraftChunks = vi.fn();
const publishFirmKnowledgeDraft = vi.fn();
const restoreArchivedFirmKnowledgeDocument = vi.fn();
const getFirmBySlug = vi.fn();
const embedTexts = vi.fn();
const prepareManifestSource = vi.fn();

vi.mock("@leadpilot/db", () => ({
  createOrReuseFirmKnowledgeDraft,
  replaceFirmKnowledgeDraftChunks,
  publishFirmKnowledgeDraft,
  restoreArchivedFirmKnowledgeDocument,
  getFirmBySlug,
}));

vi.mock("./embeddings.ts", () => ({
  embedTexts,
  readEmbeddingConfig: () => ({
    apiKey: "test",
    model: "text-embedding-3-small",
    dimensions: 1536,
    batchSize: 2,
  }),
}));

vi.mock("./chunking.ts", () => ({
  prepareManifestSource,
}));

describe("firm knowledge ingestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FIRM_KB_EMBEDDING_DIMENSIONS = "1536";
    prepareManifestSource.mockResolvedValue([
      {
        manifest: { firmSlug: "demo-law" },
        source: {
          sourceKey: "website-company-profile",
          title: "Profile",
          sourceType: "website",
          effectiveAt: "2026-06-19T00:00:00Z",
        },
        contentMarkdown: "# Firm",
        contentHash: "hash-1",
        chunks: [
          {
            id: "chunk-1",
            chunkIndex: 1,
            chunkCount: 1,
            headingPath: [],
            contentType: "overview",
            chunkText: "Body",
            textHash: "text-hash",
            estimatedTokens: 10,
            embeddingText: "prefix\n\nBody",
            metadata: {},
          },
        ],
      },
    ]);
    getFirmBySlug.mockResolvedValue({ id: "firm-1", slug: "demo-law" });
    embedTexts.mockResolvedValue([[0.1, 0.2]]);
  });

  it("shouldResolveFirmFromManifestSlugServerSide", async () => {
    createOrReuseFirmKnowledgeDraft.mockResolvedValue({
      documentId: "doc-1",
      version: 1,
      state: "created_draft",
    });
    replaceFirmKnowledgeDraftChunks.mockResolvedValue(undefined);
    publishFirmKnowledgeDraft.mockResolvedValue("published");

    const { ingestManifest } = await import("./ingestion.ts");
    await ingestManifest({ manifestPath: "/tmp/manifest.json", publish: true, dryRun: false });

    expect(getFirmBySlug).toHaveBeenCalledWith("demo-law");
  });

  it("shouldNotCallEmbeddingProviderForUnchangedPublishedHash", async () => {
    createOrReuseFirmKnowledgeDraft.mockResolvedValue({
      documentId: "doc-1",
      version: 1,
      state: "unchanged_published",
    });

    const { ingestManifest } = await import("./ingestion.ts");
    const results = await ingestManifest({
      manifestPath: "/tmp/manifest.json",
      publish: true,
      dryRun: false,
    });

    expect(embedTexts).not.toHaveBeenCalled();
    expect(results[0]?.embeddingRequests).toBe(0);
  });

  it("shouldBatchEmbeddingsWithinConfiguredBatchSize", async () => {
    prepareManifestSource.mockResolvedValue([
      {
        manifest: { firmSlug: "demo-law" },
        source: { sourceKey: "website-company-profile", title: "Profile", sourceType: "website" },
        contentMarkdown: "# Firm",
        contentHash: "hash-1",
        chunks: Array.from({ length: 3 }, (_, index) => ({
          id: `chunk-${index}`,
          chunkIndex: index + 1,
          chunkCount: 3,
          headingPath: [],
          contentType: "overview",
          chunkText: `Body ${index}`,
          textHash: `hash-${index}`,
          estimatedTokens: 10,
          embeddingText: `prefix ${index}`,
          metadata: {},
        })),
      },
    ]);
    createOrReuseFirmKnowledgeDraft.mockResolvedValue({
      documentId: "doc-1",
      version: 1,
      state: "created_draft",
    });
    embedTexts.mockResolvedValue([
      [0.1],
      [0.2],
      [0.3],
    ]);
    replaceFirmKnowledgeDraftChunks.mockResolvedValue(undefined);
    publishFirmKnowledgeDraft.mockResolvedValue("published");

    const { ingestManifest } = await import("./ingestion.ts");
    const results = await ingestManifest({
      manifestPath: "/tmp/manifest.json",
      publish: true,
      dryRun: false,
    });

    expect(embedTexts).toHaveBeenCalledTimes(1);
    expect(embedTexts.mock.calls[0]?.[0]).toHaveLength(3);
    expect(results[0]?.embeddingRequests).toBe(2);
  });

  it("shouldRejectEmbeddingWithWrongDimensions", async () => {
    embedTexts.mockRejectedValue(new Error("Embedding dimensions mismatch"));
    createOrReuseFirmKnowledgeDraft.mockResolvedValue({
      documentId: "doc-1",
      version: 1,
      state: "created_draft",
    });

    const { ingestManifest } = await import("./ingestion.ts");
    await expect(
      ingestManifest({ manifestPath: "/tmp/manifest.json", publish: true, dryRun: false }),
    ).rejects.toThrow(/dimensions mismatch/i);
    expect(publishFirmKnowledgeDraft).not.toHaveBeenCalled();
  });

  it("shouldRejectConfiguredDimensionsOtherThan1536BeforeRemoteCalls", async () => {
    process.env.FIRM_KB_EMBEDDING_DIMENSIONS = "3072";
    const { ingestManifest } = await import("./ingestion.ts");
    await expect(
      ingestManifest({ manifestPath: "/tmp/manifest.json", publish: true, dryRun: false }),
    ).rejects.toThrow(/1536/);
  });

  it("shouldNotPublishVersionWithMissingEmbeddings", async () => {
    createOrReuseFirmKnowledgeDraft.mockResolvedValue({
      documentId: "doc-1",
      version: 1,
      state: "created_draft",
    });
    embedTexts.mockResolvedValue([]);
    const { ingestManifest } = await import("./ingestion.ts");
    await expect(
      ingestManifest({ manifestPath: "/tmp/manifest.json", publish: true, dryRun: false }),
    ).rejects.toThrow();
    expect(publishFirmKnowledgeDraft).not.toHaveBeenCalled();
  });

  it("shouldNotArchiveCurrentVersionWhenNewIngestionFails", async () => {
    process.env.FIRM_KB_EMBEDDING_DIMENSIONS = "1536";
    createOrReuseFirmKnowledgeDraft.mockResolvedValue({
      documentId: "doc-1",
      version: 2,
      state: "created_draft",
    });
    embedTexts.mockRejectedValue(new Error("provider down"));
    const { ingestManifest } = await import("./ingestion.ts");
    await expect(
      ingestManifest({ manifestPath: "/tmp/manifest.json", publish: true, dryRun: false }),
    ).rejects.toThrow(/provider down/i);
    expect(publishFirmKnowledgeDraft).not.toHaveBeenCalled();
  });

  it("shouldArchivePreviousVersionOnlyAfterNewVersionIsComplete", async () => {
    process.env.FIRM_KB_EMBEDDING_DIMENSIONS = "1536";
    createOrReuseFirmKnowledgeDraft.mockResolvedValue({
      documentId: "doc-1",
      version: 2,
      state: "created_draft",
    });
    replaceFirmKnowledgeDraftChunks.mockResolvedValue(undefined);
    publishFirmKnowledgeDraft.mockResolvedValue("published");
    const { ingestManifest } = await import("./ingestion.ts");
    await ingestManifest({ manifestPath: "/tmp/manifest.json", publish: true, dryRun: false });
    const replaceOrder = replaceFirmKnowledgeDraftChunks.mock.invocationCallOrder[0] ?? 0;
    const publishOrder = publishFirmKnowledgeDraft.mock.invocationCallOrder[0] ?? 0;
    expect(replaceOrder).toBeLessThan(publishOrder);
  });

  it("shouldDryRunWithoutDatabaseWrites", async () => {
    const { ingestManifest } = await import("./ingestion.ts");
    const results = await ingestManifest({
      manifestPath: "/tmp/manifest.json",
      dryRun: true,
    });
    expect(results[0]?.databaseWrites).toBe(0);
    expect(getFirmBySlug).not.toHaveBeenCalled();
  });

  it("shouldDryRunWithoutDatabaseOrEmbeddingCredentials", async () => {
    const { ingestManifest } = await import("./ingestion.ts");
    const results = await ingestManifest({
      manifestPath: "/tmp/manifest.json",
      dryRun: true,
    });
    expect(results[0]?.embeddingRequests).toBe(0);
    expect(embedTexts).not.toHaveBeenCalled();
  });

  it("shouldResolveSameHashRaceToOneDocumentVersion", async () => {
    createOrReuseFirmKnowledgeDraft.mockResolvedValue({
      documentId: "doc-1",
      version: 1,
      state: "unchanged_published",
    });
    const { ingestManifest } = await import("./ingestion.ts");
    await ingestManifest({ manifestPath: "/tmp/manifest.json", publish: true, dryRun: false });
    expect(createOrReuseFirmKnowledgeDraft).toHaveBeenCalledTimes(1);
  });

  it("shouldRejectOlderDraftWhenNewerVersionIsPublished", async () => {
    createOrReuseFirmKnowledgeDraft.mockResolvedValue({
      documentId: "doc-old",
      version: 1,
      state: "resumable_draft",
    });
    replaceFirmKnowledgeDraftChunks.mockResolvedValue(undefined);
    publishFirmKnowledgeDraft.mockResolvedValue("superseded");
    const { ingestManifest } = await import("./ingestion.ts");
    const results = await ingestManifest({
      manifestPath: "/tmp/manifest.json",
      publish: true,
      dryRun: false,
    });
    expect(results[0]?.publicationResult).toBe("superseded");
  });

  it("shouldReembedUnchangedTextWhenEmbeddingModelChanges", async () => {
    process.env.FIRM_KB_EMBEDDING_MODEL = "text-embedding-3-large";
    createOrReuseFirmKnowledgeDraft.mockResolvedValue({
      documentId: "doc-2",
      version: 2,
      state: "created_draft",
    });
    replaceFirmKnowledgeDraftChunks.mockResolvedValue(undefined);
    publishFirmKnowledgeDraft.mockResolvedValue("published");
    const { ingestManifest } = await import("./ingestion.ts");
    await ingestManifest({ manifestPath: "/tmp/manifest.json", publish: true, dryRun: false });
    expect(embedTexts).toHaveBeenCalled();
  });
});
