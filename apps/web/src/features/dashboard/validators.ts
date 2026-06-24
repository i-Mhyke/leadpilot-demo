const ALLOWED_CONTENT_INSIGHT_FIELDS = new Set(["firmSlug", "from", "to"]);

export class ContentInsightRequestError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ContentInsightRequestError";
  }
}

function optionalIsoDate(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new ContentInsightRequestError("invalid_date", `Invalid ${field} date.`);
  }
  return value;
}

export function parseContentInsightRequest(data: unknown): {
  firmSlug: string;
  from?: string;
  to?: string;
} {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new ContentInsightRequestError("invalid_payload", "Request payload must be an object.");
  }

  const record = data as Record<string, unknown>;

  for (const key of Object.keys(record)) {
    if (!ALLOWED_CONTENT_INSIGHT_FIELDS.has(key)) {
      throw new ContentInsightRequestError(
        "unexpected_field",
        `Unexpected field "${key}" is not allowed.`,
      );
    }
  }

  if ("firmId" in record && record.firmId !== undefined) {
    throw new ContentInsightRequestError(
      "browser_firm_id_rejected",
      "Firm scope must be resolved from the route slug on the server.",
    );
  }

  if (typeof record.firmSlug !== "string" || record.firmSlug.trim().length === 0) {
    throw new ContentInsightRequestError("invalid_firm_slug", "firmSlug is required.");
  }

  return {
    firmSlug: record.firmSlug.trim(),
    from: optionalIsoDate(record.from, "from"),
    to: optionalIsoDate(record.to, "to"),
  };
}

export function parseFirmSlugRequest(data: unknown): { firmSlug: string } {
  const parsed = parseContentInsightRequest(data);
  return { firmSlug: parsed.firmSlug };
}

const ALLOWED_CONVERSATION_FIELDS = new Set(["firmSlug", "conversationId"]);

export function parseFirmConversationRequest(data: unknown): {
  firmSlug: string;
  conversationId: string;
} {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new ContentInsightRequestError("invalid_payload", "Request payload must be an object.");
  }

  const record = data as Record<string, unknown>;

  for (const key of Object.keys(record)) {
    if (!ALLOWED_CONVERSATION_FIELDS.has(key)) {
      throw new ContentInsightRequestError(
        "unexpected_field",
        `Unexpected field "${key}" is not allowed.`,
      );
    }
  }

  if ("firmId" in record && record.firmId !== undefined) {
    throw new ContentInsightRequestError(
      "browser_firm_id_rejected",
      "Firm scope must be resolved from the route slug on the server.",
    );
  }

  if (typeof record.firmSlug !== "string" || record.firmSlug.trim().length === 0) {
    throw new ContentInsightRequestError("invalid_firm_slug", "firmSlug is required.");
  }

  if (typeof record.conversationId !== "string" || record.conversationId.trim().length === 0) {
    throw new ContentInsightRequestError("invalid_conversation_id", "conversationId is required.");
  }

  return {
    firmSlug: record.firmSlug.trim(),
    conversationId: record.conversationId.trim(),
  };
}
