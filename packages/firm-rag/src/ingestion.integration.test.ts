import { afterAll, describe, expect, it } from "vitest";
import { neon } from "@neondatabase/serverless";
import {
  createOrReuseFirmKnowledgeDraft,
  publishFirmKnowledgeDraft,
  replaceFirmKnowledgeDraftChunks,
  restoreArchivedFirmKnowledgeDocument,
} from "@leadpilot/db";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for firm-rag integration tests");
}

const sql = neon(databaseUrl);
const tempSlug = `firm-kb-integration-${Date.now()}`;
let firmId = "";

function fakeVector(seed: number): string {
  return `[${Array.from({ length: 1536 }, (_, index) => ((seed + index) % 97) / 100).join(",")}]`;
}

async function createTempFirm() {
  const rows = await sql`
    INSERT INTO firms (name, slug, industry, jurisdiction, website_url, status)
    VALUES ('Integration Firm', ${tempSlug}, 'legal', 'Nigeria', 'https://example.com', 'active')
    RETURNING id
  `;
  firmId = (rows as Array<{ id: string }>)[0]!.id;
}

async function deleteTempFirm() {
  if (!firmId) return;
  await sql`DELETE FROM firms WHERE id = ${firmId}::uuid`;
}

describe("firm knowledge ingestion lifecycle", () => {
  afterAll(async () => {
    await deleteTempFirm();
  });

  it("serializes concurrent draft resolution and publishes atomically", async () => {
    await createTempFirm();

    const [first, second] = await Promise.all([
      createOrReuseFirmKnowledgeDraft({
        firmId,
        sourceKey: "integration-source",
        title: "Integration Source",
        sourceType: "manual",
        contentMarkdown: "# Version 1",
        contentHash: "hash-v1",
        expectedChunkCount: 1,
        embeddingModel: "text-embedding-3-small",
        embeddingDimensions: 1536,
        metadata: {},
      }),
      createOrReuseFirmKnowledgeDraft({
        firmId,
        sourceKey: "integration-source",
        title: "Integration Source",
        sourceType: "manual",
        contentMarkdown: "# Version 1",
        contentHash: "hash-v1",
        expectedChunkCount: 1,
        embeddingModel: "text-embedding-3-small",
        embeddingDimensions: 1536,
        metadata: {},
      }),
    ]);

    expect(first.documentId).toBe(second.documentId);
    expect(first.version).toBe(second.version);

    const incompleteDraft = await createOrReuseFirmKnowledgeDraft({
      firmId,
      sourceKey: "integration-source",
      title: "Integration Source",
      sourceType: "manual",
      contentMarkdown: "# Incomplete",
      contentHash: "hash-incomplete",
      expectedChunkCount: 2,
      embeddingModel: "text-embedding-3-small",
      embeddingDimensions: 1536,
      metadata: {},
    });

    await replaceFirmKnowledgeDraftChunks({
      firmId,
      documentId: incompleteDraft.documentId,
      chunks: [
        {
          id: "integration-chunk-partial",
          chunkIndex: 1,
          chunkCount: 2,
          headingPath: [],
          contentType: "overview",
          chunkText: "Only one of two",
          textHash: "text-partial",
          estimatedTokens: 10,
          embedding: fakeVector(9),
          embeddingModel: "text-embedding-3-small",
          embeddingDimensions: 1536,
          embeddedAt: new Date().toISOString(),
          metadata: {},
        },
      ],
    });

    await expect(
      publishFirmKnowledgeDraft({
        firmId,
        documentId: incompleteDraft.documentId,
        sourceKey: "integration-source",
      }),
    ).rejects.toThrow();

    await replaceFirmKnowledgeDraftChunks({
      firmId,
      documentId: first.documentId,
      chunks: [
        {
          id: "integration-chunk-1",
          chunkIndex: 1,
          chunkCount: 1,
          headingPath: [],
          contentType: "overview",
          chunkText: "Version 1",
          textHash: "text-v1",
          estimatedTokens: 10,
          embedding: fakeVector(1),
          embeddingModel: "text-embedding-3-small",
          embeddingDimensions: 1536,
          embeddedAt: new Date().toISOString(),
          metadata: {},
        },
      ],
    });

    expect(await publishFirmKnowledgeDraft({
      firmId,
      documentId: first.documentId,
      sourceKey: "integration-source",
    })).toBe("published");

    const versionTwo = await createOrReuseFirmKnowledgeDraft({
      firmId,
      sourceKey: "integration-source",
      title: "Integration Source",
      sourceType: "manual",
      contentMarkdown: "# Version 2",
      contentHash: "hash-v2",
      expectedChunkCount: 1,
      embeddingModel: "text-embedding-3-small",
      embeddingDimensions: 1536,
      metadata: {},
    });

    await replaceFirmKnowledgeDraftChunks({
      firmId,
      documentId: versionTwo.documentId,
      chunks: [
        {
          id: "integration-chunk-2",
          chunkIndex: 1,
          chunkCount: 1,
          headingPath: [],
          contentType: "overview",
          chunkText: "Version 2",
          textHash: "text-v2",
          estimatedTokens: 10,
          embedding: fakeVector(2),
          embeddingModel: "text-embedding-3-small",
          embeddingDimensions: 1536,
          embeddedAt: new Date().toISOString(),
          metadata: {},
        },
      ],
    });

    expect(await publishFirmKnowledgeDraft({
      firmId,
      documentId: versionTwo.documentId,
      sourceKey: "integration-source",
    })).toBe("published");

    const archived = await sql`
      SELECT id
      FROM firm_knowledge_documents
      WHERE firm_id = ${firmId}::uuid
        AND source_key = 'integration-source'
        AND status = 'archived'
      ORDER BY version ASC
      LIMIT 1
    `;

    await restoreArchivedFirmKnowledgeDocument({
      firmId,
      documentId: (archived as Array<{ id: string }>)[0]!.id,
      sourceKey: "integration-source",
      embeddingModel: "text-embedding-3-small",
      embeddingDimensions: 1536,
    });

    const supersededDraft = await createOrReuseFirmKnowledgeDraft({
      firmId,
      sourceKey: "integration-source",
      title: "Integration Source",
      sourceType: "manual",
      contentMarkdown: "# Old draft",
      contentHash: "hash-old-draft",
      expectedChunkCount: 1,
      embeddingModel: "text-embedding-3-small",
      embeddingDimensions: 1536,
      metadata: {},
    });

    await replaceFirmKnowledgeDraftChunks({
      firmId,
      documentId: supersededDraft.documentId,
      chunks: [
        {
          id: "integration-chunk-old",
          chunkIndex: 1,
          chunkCount: 1,
          headingPath: [],
          contentType: "overview",
          chunkText: "Old draft",
          textHash: "text-old",
          estimatedTokens: 10,
          embedding: fakeVector(3),
          embeddingModel: "text-embedding-3-small",
          embeddingDimensions: 1536,
          embeddedAt: new Date().toISOString(),
          metadata: {},
        },
      ],
    });

    expect(await publishFirmKnowledgeDraft({
      firmId,
      documentId: supersededDraft.documentId,
      sourceKey: "integration-source",
    })).toBe("superseded");
  });
});
