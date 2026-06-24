import {
  createOrReuseFirmKnowledgeDraft,
  getFirmBySlug,
  publishFirmKnowledgeDraft,
  replaceFirmKnowledgeDraftChunks,
  restoreArchivedFirmKnowledgeDocument,
} from "@leadpilot/db";
import { embedTexts, readEmbeddingConfig } from "./embeddings.ts";
import { prepareManifestSource } from "./chunking.ts";
import type { FirmIngestionResult } from "./types.ts";

export interface IngestManifestOptions {
  manifestPath: string;
  publish?: boolean;
  dryRun?: boolean;
  sourceKey?: string;
}

export async function ingestManifest(
  options: IngestManifestOptions,
): Promise<FirmIngestionResult[]> {
  const dryRun = options.dryRun ?? !options.publish;
  const embeddingModel = process.env.FIRM_KB_EMBEDDING_MODEL ?? "text-embedding-3-small";
  const embeddingDimensions = Number(process.env.FIRM_KB_EMBEDDING_DIMENSIONS ?? 1536);
  if (embeddingDimensions !== 1536) {
    throw new Error("FIRM_KB_EMBEDDING_DIMENSIONS must be 1536");
  }

  const preparedSources = await prepareManifestSource({
    manifestPath: options.manifestPath,
    sourceKey: options.sourceKey,
    embeddingModel,
    embeddingDimensions: 1536,
  });

  if (dryRun) {
    return preparedSources.map(({ manifest, source, contentHash, chunks }) => ({
      firmSlug: manifest.firmSlug,
      sourceKey: source.sourceKey,
      contentHash,
      chunkCount: chunks.length,
      embeddingModel,
      embeddingDimensions: 1536 as const,
      resolutionState: "dry_run",
      publicationResult: "skipped",
      embeddingRequests: 0,
      databaseWrites: 0,
    }));
  }

  const config = readEmbeddingConfig();
  if (!config) {
    throw new Error(
      "OPENAI_API_KEY is required for publish ingestion (set it in leadpilot_app/.env; npm run ingest loads that file automatically).",
    );
  }

  const results: FirmIngestionResult[] = [];

  for (const prepared of preparedSources) {
    const firm = await getFirmBySlug(prepared.manifest.firmSlug);
    if ("kind" in firm) {
      throw new Error(`Unknown or inactive firm slug: ${prepared.manifest.firmSlug}`);
    }
    const firmId = firm.id;
    let databaseWrites = 0;
    const resolution = await createOrReuseFirmKnowledgeDraft({
      firmId,
      sourceKey: prepared.source.sourceKey,
      title: prepared.source.title,
      sourceType: prepared.source.sourceType,
      sourceUri: prepared.source.sourceUri,
      contentMarkdown: prepared.contentMarkdown,
      contentHash: prepared.contentHash,
      expectedChunkCount: prepared.chunks.length,
      embeddingModel,
      embeddingDimensions: 1536,
      effectiveAt: prepared.source.effectiveAt,
      metadata: prepared.source.metadata ?? {},
    });
    databaseWrites += 1;

    let embeddingRequests = 0;
    let publicationResult: "published" | "superseded" | "skipped" = "skipped";

    if (resolution.state === "unchanged_published") {
      results.push({
        firmSlug: prepared.manifest.firmSlug,
        sourceKey: prepared.source.sourceKey,
        contentHash: prepared.contentHash,
        chunkCount: prepared.chunks.length,
        embeddingModel,
        embeddingDimensions: 1536,
        resolutionState: resolution.state,
        publicationResult,
        embeddingRequests,
        databaseWrites,
      });
      continue;
    }

    if (resolution.state === "archived_match") {
      await restoreArchivedFirmKnowledgeDocument({
        firmId,
        documentId: resolution.documentId,
        sourceKey: prepared.source.sourceKey,
        embeddingModel,
        embeddingDimensions: 1536,
      });
      databaseWrites += 1;
      results.push({
        firmSlug: prepared.manifest.firmSlug,
        sourceKey: prepared.source.sourceKey,
        contentHash: prepared.contentHash,
        chunkCount: prepared.chunks.length,
        embeddingModel,
        embeddingDimensions: 1536,
        resolutionState: resolution.state,
        publicationResult: "published",
        embeddingRequests,
        databaseWrites,
      });
      continue;
    }

    const vectors = await embedTexts(
      prepared.chunks.map((chunk) => chunk.embeddingText),
      config,
      { ingestion: true },
    );
    embeddingRequests = Math.ceil(prepared.chunks.length / config.batchSize);

    const now = new Date().toISOString();
    const chunkPayload = prepared.chunks.map((chunk, index) => ({
      id: chunk.id,
      chunkIndex: chunk.chunkIndex,
      chunkCount: chunk.chunkCount,
      headingPath: chunk.headingPath,
      contentType: chunk.contentType,
      chunkText: chunk.chunkText,
      textHash: chunk.textHash,
      estimatedTokens: chunk.estimatedTokens,
      embedding: `[${vectors[index]!.join(",")}]`,
      embeddingModel,
      embeddingDimensions: 1536,
      embeddedAt: now,
      metadata: chunk.metadata,
    }));

    await replaceFirmKnowledgeDraftChunks({
      firmId,
      documentId: resolution.documentId,
      chunks: chunkPayload,
    });
    databaseWrites += 1;

    publicationResult = await publishFirmKnowledgeDraft({
      firmId,
      documentId: resolution.documentId,
      sourceKey: prepared.source.sourceKey,
    });
    databaseWrites += 1;

    results.push({
      firmSlug: prepared.manifest.firmSlug,
      sourceKey: prepared.source.sourceKey,
      contentHash: prepared.contentHash,
      chunkCount: prepared.chunks.length,
      embeddingModel,
      embeddingDimensions: 1536,
      resolutionState: resolution.state,
      publicationResult,
      embeddingRequests,
      databaseWrites,
    });
  }

  return results;
}
