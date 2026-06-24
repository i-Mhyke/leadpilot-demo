import { createServerFn } from "@tanstack/react-start";
import {
  clearConversationCursorByBrowserSession,
  deleteConversationByBrowserSession,
  getChatHistoryByBrowserSession,
  updateConversationCursorByBrowserSession,
} from "@leadpilot/db";
import type { ChatHistoryResult } from "@leadpilot/shared";
import {
  parseChatHistoryRequest,
  parseClearChatSessionCursorRequest,
  parseDeleteChatConversationRequest,
  parsePersistChatSessionCursorRequest,
} from "./validators";

export const getChatHistory = createServerFn({ method: "GET" })
  .validator((data: unknown) => parseChatHistoryRequest(data))
  .handler(async ({ data }): Promise<ChatHistoryResult> => {
    return getChatHistoryByBrowserSession({
      firmSlug: data.firmSlug,
      browserSessionId: data.browserSessionId,
      conversationId: data.conversationId,
    });
  });

export const deleteChatConversation = createServerFn({ method: "POST" })
  .validator((data: unknown) => parseDeleteChatConversationRequest(data))
  .handler(async ({ data }): Promise<{ deleted: boolean; conversationId?: string }> => {
    return deleteConversationByBrowserSession({
      firmSlug: data.firmSlug,
      browserSessionId: data.browserSessionId,
      conversationId: data.conversationId,
    });
  });

export const persistChatSessionCursor = createServerFn({ method: "POST" })
  .validator((data: unknown) => parsePersistChatSessionCursorRequest(data))
  .handler(async ({ data }): Promise<{ conversationId?: string }> => {
    return updateConversationCursorByBrowserSession({
      firmSlug: data.firmSlug,
      browserSessionId: data.browserSessionId,
      conversationId: data.conversationId,
      sessionCursor: data.sessionCursor,
    });
  });

export const clearChatSessionCursor = createServerFn({ method: "POST" })
  .validator((data: unknown) => parseClearChatSessionCursorRequest(data))
  .handler(async ({ data }): Promise<void> => {
    await clearConversationCursorByBrowserSession({
      firmSlug: data.firmSlug,
      browserSessionId: data.browserSessionId,
      conversationId: data.conversationId,
    });
  });

import {
  getFirmBySlug,
  persistAssistantMessage,
  persistVisitorMessage,
  resolveConversationContext,
} from "@leadpilot/db";
import { parsePersistTurnRequest } from "./validators";

export const persistConversationTurn = createServerFn({ method: "POST" })
  .validator((data: unknown) => parsePersistTurnRequest(data))
  .handler(async ({ data }) => {
    const firm = await getFirmBySlug(data.firmSlug);
    if ("kind" in firm) throw new Error(firm.kind === "inactive" ? "Firm inactive." : "Unknown firm.");
    const conversation = await resolveConversationContext({
      firmId: firm.id,
      firmSlug: data.firmSlug,
      eveSessionId: data.sessionId,
      clientContext: { firmSlug: data.firmSlug, browserSessionId: data.browserSessionId },
    });
    const userTurnId = `turn_${crypto.randomUUID()}`;
    const assistantTurnId = `turn_${crypto.randomUUID()}`;
    await persistVisitorMessage({
      conversationId: conversation.id,
      firmId: firm.id,
      content: data.userMessage,
      eveTurnId: userTurnId,
    });
    await persistAssistantMessage({
      conversationId: conversation.id,
      firmId: firm.id,
      content: data.assistantMessage,
      eveTurnId: assistantTurnId,
    });
    return { conversationId: conversation.id };
  });
