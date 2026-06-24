import {
  consumeRequestRateLimit,
  RateLimitExceededError,
} from "@leadpilot/db";
import {
  buildRateLimitKey,
  LEADPILOT_CHAT_INPUT_RESPONSE_MAX_ITEMS,
  LEADPILOT_CHAT_MESSAGE_MAX_LENGTH,
  LEADPILOT_CHAT_TURN_BURST_RATE_LIMIT,
  LEADPILOT_CHAT_TURN_SUSTAINED_RATE_LIMIT,
} from "@leadpilot/shared";
import { resolveClientContextForRequest, type ClientContext } from "./client-context.ts";
import { isAllowedChatOrigin } from "./cors.ts";

export class ChatRequestGuardrailError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: 400 | 403 | 429 | 500,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ChatRequestGuardrailError";
  }
}

export type ChatIngressPayload = {
  message?: string;
  inputResponses?: unknown[];
};

export function isLeadPilotChatIngressPath(path: string) {
  return path === "/api/leadpilot/chat" || path.startsWith("/eve/v1/session");
}

export function getLeadPilotRequestIp(request: Request) {
  const candidates = [
    request.headers.get("cf-connecting-ip"),
    request.headers.get("x-real-ip"),
    request.headers.get("x-forwarded-for"),
    request.headers.get("x-vercel-forwarded-for"),
    request.headers.get("fly-client-ip"),
  ];

  for (const value of candidates) {
    const ip = value?.split(",")[0]?.trim();
    if (ip) return ip;
  }

  return "unknown-ip";
}

export function parseChatIngressPayload(input: unknown, options: { requireMessage: boolean }): ChatIngressPayload {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new ChatRequestGuardrailError("invalid_payload", "Request payload must be an object.", 400);
  }

  const record = input as Record<string, unknown>;
  const message = typeof record.message === "string" ? record.message.trim() : "";
  const inputResponses = Array.isArray(record.inputResponses) ? record.inputResponses : undefined;
  const hasTurnContent = message.length > 0 || (inputResponses?.length ?? 0) > 0;

  if (options.requireMessage && message.length === 0) {
    throw new ChatRequestGuardrailError("invalid_message", "message is required.", 400);
  }

  if (!hasTurnContent) {
    throw new ChatRequestGuardrailError(
      "invalid_turn_payload",
      "A chat turn must include a message or at least one input response.",
      400,
    );
  }

  if (message.length > LEADPILOT_CHAT_MESSAGE_MAX_LENGTH) {
    throw new ChatRequestGuardrailError(
      "message_too_long",
      `message must be ${LEADPILOT_CHAT_MESSAGE_MAX_LENGTH} characters or fewer.`,
      400,
    );
  }

  if ((inputResponses?.length ?? 0) > LEADPILOT_CHAT_INPUT_RESPONSE_MAX_ITEMS) {
    throw new ChatRequestGuardrailError(
      "too_many_input_responses",
      `inputResponses must contain ${LEADPILOT_CHAT_INPUT_RESPONSE_MAX_ITEMS} items or fewer.`,
      400,
    );
  }

  return {
    message: message || undefined,
    inputResponses,
  };
}

export async function enforceLeadPilotChatGuardrails(
  request: Request,
  payload: ChatIngressPayload,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ClientContext> {
  void payload;

  if (!isAllowedChatOrigin(request, env)) {
    throw new ChatRequestGuardrailError("forbidden_origin", "This chat origin is not allowed.", 403);
  }

  const clientContext = resolveClientContextForRequest(request, env);
  if (!clientContext?.firmSlug || !clientContext.browserSessionId) {
    throw new ChatRequestGuardrailError(
      "missing_client_context",
      "firmSlug and browserSessionId are required.",
      400,
    );
  }

  const rateLimitKey = buildRateLimitKey(
    clientContext.firmSlug,
    clientContext.browserSessionId,
    getLeadPilotRequestIp(request),
  );

  try {
    await consumeRequestRateLimit({
      ...LEADPILOT_CHAT_TURN_BURST_RATE_LIMIT,
      rateKey: rateLimitKey,
    });
    await consumeRequestRateLimit({
      ...LEADPILOT_CHAT_TURN_SUSTAINED_RATE_LIMIT,
      rateKey: rateLimitKey,
    });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      throw new ChatRequestGuardrailError(
        "rate_limited",
        "Too many chat requests. Please wait a moment and try again.",
        429,
        error.retryAfterSeconds,
      );
    }
    throw error;
  }

  return clientContext;
}
