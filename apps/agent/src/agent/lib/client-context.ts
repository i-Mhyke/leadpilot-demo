export const LEADPILOT_CLIENT_CONTEXT_HEADER = "x-leadpilot-client-context";

export interface ClientContext {
  firmSlug: string;
  browserSessionId: string;
  localConversationId?: string;
  sourceUrl?: string;
}

export function parseClientContextHeader(request: Request): ClientContext | null {
  const raw = request.headers.get(LEADPILOT_CLIENT_CONTEXT_HEADER);
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ClientContext>;
    const firmSlug = typeof parsed.firmSlug === "string" ? parsed.firmSlug.trim() : "";
    const browserSessionId = typeof parsed.browserSessionId === "string" ? parsed.browserSessionId.trim() : "";
    if (!firmSlug || !browserSessionId) return null;
    return {
      firmSlug,
      browserSessionId,
      localConversationId:
        typeof parsed.localConversationId === "string" && parsed.localConversationId.trim()
          ? parsed.localConversationId.trim()
          : undefined,
      sourceUrl: typeof parsed.sourceUrl === "string" && parsed.sourceUrl.trim() ? parsed.sourceUrl.trim() : undefined,
    };
  } catch { return null; }
}

interface EnvVars {
  LEADPILOT_DEV_FIRM_SLUG?: string;
  LEADPILOT_DEV_BROWSER_SESSION_ID?: string;
  NODE_ENV?: string;
  LEADPILOT_STRICT_INTAKE?: string;
}

export function resolveClientContextForRequest(request: Request, env: EnvVars = process.env): ClientContext | null {
  const fromHeader = parseClientContextHeader(request);
  if (fromHeader?.firmSlug && fromHeader?.browserSessionId) return fromHeader;
  const devFirmSlug = env.LEADPILOT_DEV_FIRM_SLUG?.trim();
  if (!devFirmSlug || env.NODE_ENV === "production" || env.LEADPILOT_STRICT_INTAKE === "true") return null;
  return {
    firmSlug: devFirmSlug,
    browserSessionId: env.LEADPILOT_DEV_BROWSER_SESSION_ID?.trim() || "dev-terminal",
    sourceUrl: "eve://dev-terminal",
  };
}
