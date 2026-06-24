import type { ConversationMetadata } from "@leadpilot/shared";

export class ChatRequestError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ChatRequestError";
  }
}

export function parseChatHistoryRequest(data: unknown): {
  firmSlug: string;
  browserSessionId: string;
  conversationId?: string;
} {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new ChatRequestError("invalid_payload", "Request payload must be an object.");
  }

  const record = data as Record<string, unknown>;

  if (typeof record.firmSlug !== "string" || record.firmSlug.trim().length === 0) {
    throw new ChatRequestError("invalid_firm_slug", "firmSlug is required.");
  }

  if (typeof record.browserSessionId !== "string" || record.browserSessionId.trim().length === 0) {
    throw new ChatRequestError("invalid_browser_session", "browserSessionId is required.");
  }

  return {
    firmSlug: record.firmSlug.trim(),
    browserSessionId: record.browserSessionId.trim(),
    conversationId:
      typeof record.conversationId === "string" && record.conversationId.trim().length > 0
        ? record.conversationId.trim()
        : undefined,
  };
}

export function parseDeleteChatConversationRequest(data: unknown): {
  firmSlug: string;
  browserSessionId: string;
  conversationId?: string;
} {
  return parseChatHistoryRequest(data);
}

export function parsePersistChatSessionCursorRequest(data: unknown): {
  firmSlug: string;
  browserSessionId: string;
  conversationId?: string;
  sessionCursor: {
    sessionId: string;
    continuationToken?: string;
    streamIndex: number;
    needsReconciliation?: boolean;
  };
} {
  const base = parseChatHistoryRequest(data);
  const record = data as Record<string, unknown>;
  const cursor = record.sessionCursor;

  if (cursor === null || typeof cursor !== "object" || Array.isArray(cursor)) {
    throw new ChatRequestError("invalid_session_cursor", "sessionCursor is required.");
  }

  const cursorRecord = cursor as Record<string, unknown>;
  if (
    typeof cursorRecord.streamIndex !== "number" ||
    !Number.isInteger(cursorRecord.streamIndex) ||
    cursorRecord.streamIndex < 0
  ) {
    throw new ChatRequestError("invalid_stream_index", "sessionCursor.streamIndex must be a non-negative integer.");
  }

  const sessionId =
    typeof cursorRecord.sessionId === "string" && cursorRecord.sessionId.trim()
      ? cursorRecord.sessionId.trim()
      : undefined;
  const continuationToken =
    typeof cursorRecord.continuationToken === "string" && cursorRecord.continuationToken.trim()
      ? cursorRecord.continuationToken.trim()
      : undefined;
  const needsReconciliation = cursorRecord.needsReconciliation === true;

  if (needsReconciliation) {
    if (!sessionId) {
      throw new ChatRequestError(
        "invalid_session_cursor",
        "sessionCursor must include sessionId while reconciliation is pending.",
      );
    }

    return {
      ...base,
      sessionCursor: {
        sessionId,
        continuationToken,
        streamIndex: cursorRecord.streamIndex,
        needsReconciliation: true,
      },
    };
  }

  if (!sessionId || !continuationToken || cursorRecord.streamIndex === 0) {
    throw new ChatRequestError(
      "invalid_session_cursor",
      "sessionCursor must include a resumable sessionId, continuationToken, and positive streamIndex.",
    );
  }

  return {
    ...base,
    sessionCursor: {
      sessionId,
      continuationToken,
      streamIndex: cursorRecord.streamIndex,
    },
  };
}

export function parseClearChatSessionCursorRequest(data: unknown): {
  firmSlug: string;
  browserSessionId: string;
  conversationId?: string;
} {
  return parseChatHistoryRequest(data);
}

export type PersistTurnInput = {
  firmSlug: string;
  browserSessionId: string;
  userMessage: string;
  assistantMessage: string;
  sessionId: string;
  assistantMetadata?: ConversationMetadata;
};

export function parsePersistTurnRequest(data: unknown): PersistTurnInput {
  const base = parseChatHistoryRequest(data);
  const record = data as Record<string, unknown>;
  if (typeof record.userMessage !== "string" || record.userMessage.trim().length === 0) {
    throw new ChatRequestError("invalid_user_message", "userMessage is required.");
  }
  if (typeof record.assistantMessage !== "string" || record.assistantMessage.trim().length === 0) {
    throw new ChatRequestError("invalid_assistant_message", "assistantMessage is required.");
  }
  if (typeof record.sessionId !== "string" || record.sessionId.trim().length === 0) {
    throw new ChatRequestError("invalid_session_id", "sessionId is required.");
  }
  if (
    record.assistantMetadata !== undefined &&
    (record.assistantMetadata === null ||
      typeof record.assistantMetadata !== "object" ||
      Array.isArray(record.assistantMetadata))
  ) {
    throw new ChatRequestError("invalid_assistant_metadata", "assistantMetadata must be an object when provided.");
  }
  return {
    ...base,
    userMessage: record.userMessage.trim(),
    assistantMessage: record.assistantMessage.trim(),
    sessionId: record.sessionId.trim(),
    assistantMetadata: record.assistantMetadata as ConversationMetadata | undefined,
  };
}

export type BookingSelectionInput = {
  firmSlug: string;
  browserSessionId: string;
  sessionId: string;
  preferredBookingAt: string;
  preferredBookingLabel?: string;
};

export function parseBookingSelectionRequest(data: unknown): BookingSelectionInput {
  const base = parseChatHistoryRequest(data);
  const record = data as Record<string, unknown>;

  if (typeof record.sessionId !== "string" || record.sessionId.trim().length === 0) {
    throw new ChatRequestError("invalid_session_id", "sessionId is required.");
  }

  if (typeof record.preferredBookingAt !== "string" || record.preferredBookingAt.trim().length === 0) {
    throw new ChatRequestError("invalid_preferred_booking_at", "preferredBookingAt is required.");
  }

  return {
    ...base,
    sessionId: record.sessionId.trim(),
    preferredBookingAt: record.preferredBookingAt.trim(),
    preferredBookingLabel:
      typeof record.preferredBookingLabel === "string" && record.preferredBookingLabel.trim().length > 0
        ? record.preferredBookingLabel.trim()
        : undefined,
  };
}
