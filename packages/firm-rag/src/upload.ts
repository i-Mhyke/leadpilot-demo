import {
  createOrReuseFirmKnowledgeDraft,
  publishFirmKnowledgeDraft,
  replaceFirmKnowledgeDraftChunks,
  restoreArchivedFirmKnowledgeDocument,
} from "@leadpilot/db";
import { embedTexts, readEmbeddingConfig } from "./embeddings.ts";
import { buildContentHashEnvelope, chunkFirmSource, normalizeMarkdown } from "./chunking.ts";
import type { FirmKnowledgeUploadResult } from "./types.ts";

export const ADMIN_KNOWLEDGE_BASE_SOURCE_KEY = "admin-company-knowledge-base";
const ADMIN_KNOWLEDGE_BASE_TITLE = "Company knowledge base";

export async function ingestUploadedFirmKnowledgeMarkdown(input: {
  firmId: string;
  firmSlug: string;
  firmDisplayName: string;
  contentMarkdown: string;
}): Promise<FirmKnowledgeUploadResult> {
  const normalizedMarkdown = normalizeMarkdown(input.contentMarkdown);
  if (!normalizedMarkdown.trim()) {
    throw new Error("Knowledge base markdown cannot be empty.");
  }

  const embeddingConfig = readEmbeddingConfig();
  if (!embeddingConfig) {
    throw new Error(
      "OPENAI_API_KEY is required for publish ingestion (set it in leadpilot_app/.env; npm run ingest loads that file automatically).",
    );
  }

  const manifest = {
    schemaVersion: 1 as const,
    firmSlug: input.firmSlug,
    firmDisplayName: input.firmDisplayName,
    sources: [
      {
        sourceKey: ADMIN_KNOWLEDGE_BASE_SOURCE_KEY,
        title: ADMIN_KNOWLEDGE_BASE_TITLE,
        sourceType: "manual" as const,
        sourceUri: undefined,
        path: "admin-company-knowledge-base.md",
        metadata: { adminUpload: true, source: "admin_tenants" },
      },
    ],
  };

  const source = manifest.sources[0]!;
  const contentHash = buildContentHashEnvelope({
    schemaVersion: manifest.schemaVersion,
    firmDisplayName: manifest.firmDisplayName,
    sourceKey: source.sourceKey,
    title: source.title,
    sourceType: source.sourceType,
    sourceUri: source.sourceUri ?? null,
    effectiveAt: null,
    metadata: source.metadata ?? {},
    contentMarkdown: normalizedMarkdown,
  });
  const chunks = chunkFirmSource({
    manifest,
    source,
    contentMarkdown: normalizedMarkdown,
    embeddingModel: embeddingConfig.model,
    embeddingDimensions: 1536,
  });

  if (chunks.length === 0) {
    throw new Error("Knowledge base markdown must include at least one content section.");
  }

  const resolution = await createOrReuseFirmKnowledgeDraft({
    firmId: input.firmId,
    sourceKey: source.sourceKey,
    title: source.title,
    sourceType: source.sourceType,
    sourceUri: source.sourceUri,
    contentMarkdown: normalizedMarkdown,
    contentHash,
    expectedChunkCount: chunks.length,
    embeddingModel: embeddingConfig.model,
    embeddingDimensions: 1536,
    metadata: source.metadata ?? {},
  });

  let databaseWrites = 1;
  let embeddingRequests = 0;
  let publicationResult: "published" | "superseded" | "skipped" = "skipped";

  if (resolution.state === "unchanged_published") {
    return {
      firmSlug: input.firmSlug,
      sourceKey: source.sourceKey,
      version: resolution.version,
      revision: resolution.version,
      contentHash,
      chunkCount: chunks.length,
      resolutionState: resolution.state,
      publicationResult,
      embeddingRequests,
      databaseWrites,
    };
  }

  if (resolution.state === "archived_match") {
    await restoreArchivedFirmKnowledgeDocument({
      firmId: input.firmId,
      documentId: resolution.documentId,
      sourceKey: source.sourceKey,
      embeddingModel: embeddingConfig.model,
      embeddingDimensions: 1536,
    });
    databaseWrites += 1;
  } else {
    const vectors = await embedTexts(
      chunks.map((chunk) => chunk.embeddingText),
      embeddingConfig,
      { ingestion: true },
    );
    embeddingRequests = Math.ceil(chunks.length / embeddingConfig.batchSize);
    const now = new Date().toISOString();
    await replaceFirmKnowledgeDraftChunks({
      firmId: input.firmId,
      documentId: resolution.documentId,
      chunks: chunks.map((chunk, index) => ({
        id: chunk.id,
        chunkIndex: chunk.chunkIndex,
        chunkCount: chunk.chunkCount,
        headingPath: chunk.headingPath,
        contentType: chunk.contentType,
        chunkText: chunk.chunkText,
        textHash: chunk.textHash,
        estimatedTokens: chunk.estimatedTokens,
        embedding: `[${vectors[index]!.join(",")}]`,
        embeddingModel: embeddingConfig.model,
        embeddingDimensions: 1536,
        embeddedAt: now,
        metadata: chunk.metadata,
      })),
    });
    databaseWrites += 1;
  }

  publicationResult = await publishFirmKnowledgeDraft({
    firmId: input.firmId,
    documentId: resolution.documentId,
    sourceKey: source.sourceKey,
  });
  databaseWrites += 1;

  return {
    firmSlug: input.firmSlug,
    sourceKey: source.sourceKey,
    version: resolution.version,
    revision: resolution.version,
    contentHash,
    chunkCount: chunks.length,
    resolutionState: resolution.state,
    publicationResult,
    embeddingRequests,
    databaseWrites,
  };
}
