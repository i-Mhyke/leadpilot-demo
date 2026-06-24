export interface RateLimitPolicy {
  scope: string;
  limit: number;
  windowMs: number;
}

function normalizeRateLimitPart(value: string | number | null | undefined) {
  const normalized = String(value ?? "").trim();
  return normalized ? encodeURIComponent(normalized) : "";
}

export function buildRateLimitKey(...parts: Array<string | number | null | undefined>) {
  return parts.map(normalizeRateLimitPart).filter(Boolean).join(":");
}

export const LEADPILOT_CHAT_TURN_BURST_RATE_LIMIT: RateLimitPolicy = {
  scope: "chat.turn.burst",
  limit: 8,
  windowMs: 60_000,
};

export const LEADPILOT_CHAT_TURN_SUSTAINED_RATE_LIMIT: RateLimitPolicy = {
  scope: "chat.turn.sustained",
  limit: 30,
  windowMs: 15 * 60_000,
};

export const LEADPILOT_CHAT_MESSAGE_MAX_LENGTH = 4_000;
export const LEADPILOT_CHAT_INPUT_RESPONSE_MAX_ITEMS = 6;
