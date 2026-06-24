import { beforeEach, describe, expect, it, vi } from "vitest";
import { setSqlForTests } from "@leadpilot/db";
import { ingestUploadedFirmKnowledgeMarkdown } from "./upload.ts";

const dbMocks = vi.hoisted(() => ({
  createOrReuseFirmKnowledgeDraft: vi.fn(),
  replaceFirmKnowledgeDraftChunks: vi.fn(),
  publishFirmKnowledgeDraft: vi.fn(),
  restoreArchivedFirmKnowledgeDocument: vi.fn(),
}));

const embeddingMocks = vi.hoisted(() => ({
  readEmbeddingConfig: vi.fn(),
  embedTexts: vi.fn(),
}));

vi.mock("@leadpilot/db", async (importOriginal) => {
  const original = await importOriginal<typeof import("@leadpilot/db")>();
  return {
    ...original,
    createOrReuseFirmKnowledgeDraft: dbMocks.createOrReuseFirmKnowledgeDraft,
    replaceFirmKnowledgeDraftChunks: dbMocks.replaceFirmKnowledgeDraftChunks,
    publishFirmKnowledgeDraft: dbMocks.publishFirmKnowledgeDraft,
    restoreArchivedFirmKnowledgeDocument: dbMocks.restoreArchivedFirmKnowledgeDocument,
  };
});

vi.mock("./embeddings.ts", () => ({
  readEmbeddingConfig: embeddingMocks.readEmbeddingConfig,
  embedTexts: embeddingMocks.embedTexts,
}));

describe("ingestUploadedFirmKnowledgeMarkdown", () => {
  beforeEach(() => {
    setSqlForTests(null);
    dbMocks.createOrReuseFirmKnowledgeDraft.mockReset();
    dbMocks.replaceFirmKnowledgeDraftChunks.mockReset();
    dbMocks.publishFirmKnowledgeDraft.mockReset();
    dbMocks.restoreArchivedFirmKnowledgeDocument.mockReset();
    embeddingMocks.readEmbeddingConfig.mockReset();
    embeddingMocks.embedTexts.mockReset();
  });

  it("embeds and publishes the uploaded markdown through the existing KB flow", async () => {
    embeddingMocks.readEmbeddingConfig.mockReturnValue({
      model: "text-embedding-3-small",
      batchSize: 2,
      timeoutMs: 30_000,
    });
    embeddingMocks.embedTexts.mockResolvedValue([[0.1, 0.2], [0.3, 0.4]]);
    dbMocks.createOrReuseFirmKnowledgeDraft.mockResolvedValue({
      documentId: "doc-1",
      version: 2,
      state: "created_draft",
    });
    dbMocks.publishFirmKnowledgeDraft.mockResolvedValue("published");

    const result = await ingestUploadedFirmKnowledgeMarkdown({
      firmId: "firm-a",
      firmSlug: "northline-advisory",
      firmDisplayName: "Northline Advisory",
      contentMarkdown: `
# Company knowledge

## Overview
Northline Advisory is a consulting firm.

## Services
- Lead qualification
- Booking support
`,
    });

    expect(result.version).toBe(2);
    expect(result.publicationResult).toBe("published");
    expect(result.embeddingRequests).toBe(1);
    expect(dbMocks.createOrReuseFirmKnowledgeDraft).toHaveBeenCalled();
    expect(dbMocks.replaceFirmKnowledgeDraftChunks).toHaveBeenCalled();
    expect(dbMocks.publishFirmKnowledgeDraft).toHaveBeenCalled();
  });

  it("fails cleanly on empty markdown and does not publish", async () => {
    embeddingMocks.readEmbeddingConfig.mockReturnValue({
      model: "text-embedding-3-small",
      batchSize: 2,
      timeoutMs: 30_000,
    });

    await expect(
      ingestUploadedFirmKnowledgeMarkdown({
        firmId: "firm-a",
        firmSlug: "northline-advisory",
        firmDisplayName: "Northline Advisory",
        contentMarkdown: "   ",
      }),
    ).rejects.toThrow(/cannot be empty/i);

    expect(dbMocks.createOrReuseFirmKnowledgeDraft).not.toHaveBeenCalled();
    expect(dbMocks.publishFirmKnowledgeDraft).not.toHaveBeenCalled();
  });
});
