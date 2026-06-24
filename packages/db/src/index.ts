export interface DatabaseConfig {
  databaseUrl: string;
}

export function getDatabaseConfig(): DatabaseConfig {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }
  return { databaseUrl };
}

export const tables = {
  firms: "firms",
  firmServices: "firm_services",
  firmBookingPolicies: "firm_booking_policies",
  firmPricingPolicies: "firm_pricing_policies",
  firmAgentToneProfiles: "firm_agent_tone_profiles",
  visitors: "visitors",
  conversations: "conversations",
  conversationMessages: "conversation_messages",
  conversationEvents: "conversation_events",
  requestRateLimits: "request_rate_limits",
  leadProfiles: "lead_profiles",
  leadScoreEvents: "lead_score_events",
  bookingRequests: "booking_requests",
  retrievalLogs: "retrieval_logs",
  conversationTopics: "conversation_topics",
  conversationAnalysisRuns: "conversation_analysis_runs",
  contentRecommendations: "content_recommendations",
  firmKnowledgeDocuments: "firm_knowledge_documents",
  firmKnowledgeChunks: "firm_knowledge_chunks",
  knowledgeNodes: "knowledge_nodes",
  knowledgeEdges: "knowledge_edges",
  chunkGraphNeighbors: "chunk_graph_neighbors",
  firmBrains: "firm_brains",
} as const;

export { getSql, setSqlForTests } from "./client.ts";
export {
  createFirm,
  getFirmBySlug,
  getFirmProfile,
  getFirmProfileBySlug,
  getFirmBookingPolicy,
  getFirmPricingPolicy,
  getFirmToneProfile,
  listActiveFirmServices,
  listActiveFirms,
  type FirmInactive,
  type FirmNotFound,
} from "./firms.ts";
export {
  FirmBrainCompilationError,
  compileFirmBrainMarkdown,
  getFirmBrainConfigByFirmId,
  getFirmBrainSnapshotByFirmId,
  saveFirmBrainConfig,
} from "./firm-brain.ts";
export {
  appendConversationEvent,
  clearConversationCursorByBrowserSession,
  deleteConversationByBrowserSession,
  findOrCreateConversation,
  findOrCreateVisitor,
  getConversationByEveSession,
  listRecentConversations,
  markConversationFailed,
  markConversationFailedByEveSession,
  persistAssistantMessage,
  persistVisitorMessage,
  resolveConversationContext,
  updateConversationCursor,
  updateConversationCursorByBrowserSession,
  getChatHistoryByBrowserSession,
  type ClientContextInput,
} from "./conversations.ts";
export { consumeRequestRateLimit, RateLimitExceededError, type RequestRateLimitPolicy, type RequestRateLimitState } from "./request-rate-limits.ts";
export {
  appendLeadScoreEvent,
  createBookingRequest,
  findOpenBookingRequest,
  upsertLeadProfile,
} from "./leads.ts";
export {
  assertFirmConversation,
  assertFirmLeadForConversation,
  assertFirmService,
  assertFirmVisitor,
  getConversationWriteScope,
  FirmOwnershipError,
  resolveFirmServiceId,
} from "./firm-ownership.ts";
export {
  exactSearchChunks,
  expandGraphNeighbors,
  relaxedLexicalSearchChunks,
  logRetrieval,
  semanticSearchChunks,
  type LegalChunkRow,
  type RetrievalLogInput,
  type RetrievalResultSource,
  type RetrievalScope,
} from "./legal-knowledge.ts";
export {
  FirmKnowledgeScopeError,
  createOrReuseFirmKnowledgeDraft,
  lexicalSearchFirmKnowledge,
  publishFirmKnowledgeDraft,
  replaceFirmKnowledgeDraftChunks,
  restoreArchivedFirmKnowledgeDocument,
  semanticSearchFirmKnowledge,
  type FirmKnowledgeChunkRow,
} from "./firm-knowledge.ts";
export {
  commitContentInsightRunWithRecommendations,
  createContentRecommendations,
  createContentInsightRun,
  countFirmConversationsInRange,
  deleteContentRecommendationsForInsightRun,
  failContentInsightRun,
  findRunningContentInsightRunForRange,
  listContentInsightSourceConversations,
  markContentInsightRunCompleted,
  markContentInsightRunFailed,
  recordConversationTopic,
  saveConversationAnalysis,
  summarizeContentInsightTopics,
} from "./analytics.ts";
export {
  CONVERSATION_CONTEXT_PREVIEW_LIMIT,
  getFirmBookingDetailBySlug,
  getFirmDashboardOverviewBySlug,
  listFirmBookingRequestItemsBySlug,
  listFirmConversationLeadsBySlug,
} from "./dashboard.ts";
export {
  getFirmConversationInsightsBySlug,
  listFirmContentRecommendationsBySlug,
  rejectBrowserFirmId,
  runOnDemandContentInsight,
  validateInsightDateRange,
  type OnDemandContentInsightInput,
} from "./content-intelligence.ts";
