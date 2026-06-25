export const LEADPILOT_CORS_HEADERS = ["content-type", "x-leadpilot-client-context"].join(", ");

type EnvVars = {
  LEADPILOT_ALLOWED_ORIGINS?: string;
  LEADPILOT_PUBLIC_CHAT?: string;
  NODE_ENV?: string;
};

export function getAllowedChatOrigins(env: EnvVars = process.env): string[] | null {
  const raw = env.LEADPILOT_ALLOWED_ORIGINS?.trim();
  if (!raw) return null;
  return raw.split(",").map((value) => value.trim()).filter(Boolean);
}

export function isAllowedChatOrigin(request: Request, env: EnvVars = process.env): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) return env.NODE_ENV !== "production";

  const allowlist = getAllowedChatOrigins(env);
  if (allowlist) return allowlist.includes(origin);

  if (env.LEADPILOT_PUBLIC_CHAT === "true") return true;

  return env.NODE_ENV !== "production";
}

export function resolveCorsAllowedOrigin(request: Request, env: EnvVars = process.env): string | null {
  const origin = request.headers.get("Origin");
  if (!origin) return env.NODE_ENV !== "production" ? "*" : null;

  const allowlist = getAllowedChatOrigins(env);
  if (allowlist) {
    return allowlist.includes(origin) ? origin : null;
  }

  if (env.LEADPILOT_PUBLIC_CHAT === "true") return origin;
  return env.NODE_ENV !== "production" ? origin : null;
}

export function corsPreflightResponse(request: Request, env: EnvVars = process.env): Response {
  const origin = resolveCorsAllowedOrigin(request, env);
  if (!origin) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": LEADPILOT_CORS_HEADERS, "Access-Control-Max-Age": "86400" } });
}
