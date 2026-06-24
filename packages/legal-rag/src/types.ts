export interface LegalSearchInput {
  query: string;
  firmId: string;
  conversationId?: string;
  messageId?: string;
  limit?: number;
  graphDepth?: number;
  auditMode?: "standalone" | "deferred";
}

export interface LegalSearchResult {
  chunkId: string;
  parentUnitId: string;
  documentId: string;
  citation: string;
  sourceFile: string;
  text: string;
  similarity?: number;
  exactMatchScore?: number;
  relationshipType?: string;
  relationshipReason?: string;
  sourceEffectiveDate?: string;
  sourcePublishedDate?: string;
  freshnessRank?: number;
}

export type LegalSearchStatus = "ok" | "empty" | "failed";

export interface LegalSearchResponse {
  status: LegalSearchStatus;
  results: LegalSearchResult[];
  errorMessage?: string;
}
