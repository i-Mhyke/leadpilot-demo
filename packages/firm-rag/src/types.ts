import { z } from "zod";

export const MAX_MANIFEST_BYTES = 65_536;
export const MAX_SOURCES = 10;
export const MAX_SOURCE_BYTES = 2_097_152;
export const MAX_METADATA_BYTES = 16_384;
export const MAX_METADATA_DEPTH = 5;
export const MAX_METADATA_KEYS = 100;
export const MAX_CHUNKS_PER_SOURCE = 2_000;

export const TARGET_TOKENS = 450;
export const HARD_MAX_TOKENS = 800;
export const SPLIT_OVERLAP_TOKENS = 60;

export const firmKnowledgeSourceSchema = z
  .object({
    sourceKey: z.string().min(1).max(120),
    title: z.string().min(1).max(200),
    sourceType: z.enum(["website", "manual", "policy", "faq", "publication"]),
    sourceUri: z.string().url().max(2048).optional(),
    path: z.string().min(1).max(255),
    effectiveAt: z.string().datetime().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const firmKnowledgeManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    firmSlug: z.string().min(1).max(100),
    firmDisplayName: z.string().min(1).max(100),
    sources: z.array(firmKnowledgeSourceSchema).min(1).max(MAX_SOURCES),
  })
  .strict()
  .superRefine((manifest, ctx) => {
    if ("firmId" in manifest) {
      ctx.addIssue({ code: "custom", message: "firmId is not allowed in manifest" });
    }
  });

export type FirmKnowledgeManifest = z.infer<typeof firmKnowledgeManifestSchema>;
export type FirmKnowledgeSource = z.infer<typeof firmKnowledgeSourceSchema>;

export type FirmContentType =
  | "overview"
  | "service"
  | "person"
  | "publication"
  | "contact"
  | "compliance"
  | "positioning"
  | "other";

export interface PreparedFirmChunk {
  id: string;
  chunkIndex: number;
  chunkCount: number;
  headingPath: string[];
  contentType: FirmContentType;
  chunkText: string;
  textHash: string;
  estimatedTokens: number;
  embeddingText: string;
  metadata: Record<string, unknown>;
}

export interface FirmSearchResult {
  source: "firm";
  title: string;
  contentType: FirmContentType;
  headingPath: string[];
  text: string;
  informationalOnly?: boolean;
  chunkId: string;
  documentId: string;
  similarity?: number;
  lexicalRank?: number;
}

export type FirmSearchStatus = "ok" | "empty" | "failed";

export interface FirmSearchResponse {
  status: FirmSearchStatus;
  results: FirmSearchResult[];
  degradedSources: string[];
  errorMessage?: string;
  internalResultIds?: Array<{
    source: "firm";
    chunkId: string;
    documentId: string;
    rank: number;
  }>;
}

export interface FirmIngestionResult {
  firmSlug: string;
  sourceKey: string;
  contentHash: string;
  chunkCount: number;
  embeddingModel: string;
  embeddingDimensions: 1536;
  resolutionState:
    | "unchanged_published"
    | "resumable_draft"
    | "archived_match"
    | "created_draft"
    | "dry_run";
  publicationResult?: "published" | "superseded" | "skipped";
  embeddingRequests: number;
  databaseWrites: number;
}

export interface FirmKnowledgeUploadResult {
  firmSlug: string;
  sourceKey: string;
  version: number;
  revision: number;
  contentHash: string;
  chunkCount: number;
  resolutionState: "unchanged_published" | "resumable_draft" | "archived_match" | "created_draft";
  publicationResult: "published" | "superseded" | "skipped";
  embeddingRequests: number;
  databaseWrites: number;
}

export type AuditMode = "standalone" | "deferred";

export interface FirmSearchInput {
  query: string;
  firmId: string;
  conversationId?: string;
  messageId?: string;
  limit?: number;
  auditMode?: AuditMode;
}
