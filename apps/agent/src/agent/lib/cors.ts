export const LEADPILOT_CORS_HEADERS = ["content-type", "x-leadpilot-client-context"].join(", ");

function allowedOrigins(): string[] | null {
  const raw = process.env.LEADPILOT_ALLOWED_ORIGINS?.trim();
  if (!raw) return null;
  return raw.split(",").map((value) => value.trim()).filter(Boolean);
}

export function resolveCorsAllowedOrigin(request: Request): string | null {
  const origin = request.headers.get("Origin");
  if (!origin) {
    return process.env.LEADPILOT_PUBLIC_CHAT === "true" ? "*" : null;
  }

  const allowlist = allowedOrigins();
  if (allowlist) {
    return allowlist.includes(origin) ? origin : null;
  }

  if (process.env.LEADPILOT_PUBLIC_CHAT === "true") return origin;
  return origin;
}

export function corsPreflightResponse(request: Request): Response {
  const origin = resolveCorsAllowedOrigin(request);
  if (!origin) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": LEADPILOT_CORS_HEADERS, "Access-Control-Max-Age": "86400" } });
}
