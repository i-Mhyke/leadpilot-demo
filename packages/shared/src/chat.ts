import type { ConversationMessage } from "./conversation.ts";

export interface ChatSessionCursor {
  sessionId?: string;
  continuationToken?: string;
  streamIndex: number;
  needsReconciliation?: boolean;
}

export interface ChatHistoryResult {
  found: boolean;
  conversationId?: string;
  messages: ConversationMessage[];
  sessionCursor?: ChatSessionCursor;
}

const RAW_PROVIDER_THINKING_FALLBACK_PATTERN =
  /\n*\(Empty response:\s*[\s\S]*?['"]type['"]\s*:\s*['"]thinking['"][\s\S]*\)\s*$/;

export function stripRawProviderThinkingFallback(content: string): string {
  return content.replace(RAW_PROVIDER_THINKING_FALLBACK_PATTERN, "").trim();
}
