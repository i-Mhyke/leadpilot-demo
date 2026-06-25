import { dispatch } from "@flue/runtime";
import { flue } from "@flue/runtime/routing";
import { Hono } from "hono";
import { registerObservability } from "./instrumentation.ts";
import {
  corsPreflightResponse,
  getAllowedChatOrigins,
  LEADPILOT_CORS_HEADERS,
  resolveCorsAllowedOrigin,
} from "./agent/lib/cors.ts";
import {
  ChatRequestGuardrailError,
  enforceLeadPilotChatGuardrails,
  isLeadPilotChatIngressPath,
  parseChatIngressPayload,
} from "./agent/lib/chat-guardrails.ts";
import { logLeadPilotEvent } from "./agent/lib/observability.ts";

registerObservability();
logLeadPilotEvent("agent.cors.config", {
  allowedOrigins: getAllowedChatOrigins() ?? [],
  publicChat: process.env.LEADPILOT_PUBLIC_CHAT === "true",
  nodeEnv: process.env.NODE_ENV ?? "",
});

const app = new Hono();

app.use("*", async (c, next) => {
  if (c.req.method === "OPTIONS") {
    return corsPreflightResponse(c.req.raw);
  }

  const path = c.req.path;
  const isChatIngress = isLeadPilotChatIngressPath(path);
  const isCorsRelevantRoute = isChatIngress || path.startsWith("/agents/");
  const origin = isCorsRelevantRoute ? resolveCorsAllowedOrigin(c.req.raw) : null;

  if (isCorsRelevantRoute && !origin && c.req.header("Origin")) {
    return c.json({ error: "forbidden_origin", message: "This chat origin is not allowed." }, 403);
  }

  if (path.startsWith("/eve/v1/session") && c.req.method === "POST") {
    let payload: ReturnType<typeof parseChatIngressPayload>;
    try {
      payload = parseChatIngressPayload(await c.req.raw.clone().json(), { requireMessage: false });
      await enforceLeadPilotChatGuardrails(c.req.raw, payload);
    } catch (error) {
      if (error instanceof ChatRequestGuardrailError) {
        if (origin) c.header("Access-Control-Allow-Origin", origin);
        return c.json(
          {
            error: error.code,
            message: error.message,
            retryAfterSeconds: error.retryAfterSeconds,
          },
          error.status,
        );
      }
      if (origin) c.header("Access-Control-Allow-Origin", origin);
      return c.json({ error: "invalid_request", message: "Invalid chat request." }, 400);
    }
  }

  await next();

  if (origin) {
    c.header("Access-Control-Allow-Origin", origin);
    c.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    c.header("Access-Control-Allow-Headers", LEADPILOT_CORS_HEADERS);
  }
});

app.get("/health", (c) => c.json({ ok: true, service: "leadpilot-flue" }));

app.post("/api/leadpilot/chat", async (c) => {
  const origin = resolveCorsAllowedOrigin(c.req.raw);
  if (!origin) return c.json({ error: "forbidden_origin", message: "This chat origin is not allowed." }, 403);
  c.header("Access-Control-Allow-Origin", origin);

  let body: { message?: string };
  try {
    body = await c.req.json<{ message?: string }>();
  } catch {
    return c.json({ error: "invalid_json", message: "Invalid JSON body." }, 400);
  }

  let payload: ReturnType<typeof parseChatIngressPayload>;
  try {
    payload = parseChatIngressPayload(body, { requireMessage: true });
  } catch (error) {
    if (error instanceof ChatRequestGuardrailError) {
      return c.json(
        {
          error: error.code,
          message: error.message,
          retryAfterSeconds: error.retryAfterSeconds,
        },
        error.status,
      );
    }
    return c.json({ error: "invalid_request", message: "Invalid chat request." }, 400);
  }

  const clientContext = await enforceLeadPilotChatGuardrails(c.req.raw, payload);
  const fallbackFirmSlug = process.env.LEADPILOT_DEV_FIRM_SLUG?.trim() || "";
  const firmSlug = clientContext.firmSlug || fallbackFirmSlug;
  const browserSessionId = clientContext.browserSessionId || `browser:${crypto.randomUUID()}`;

  if (!firmSlug) return c.json({ error: "missing_firm_context", message: "Missing firm context." }, 400);

  const agentId = `${firmSlug}/${browserSessionId}`;
  const streamUrl = `/agents/leadpilot/${encodeURIComponent(agentId)}`;

  try {
    const receipt = await dispatch({
      agent: "leadpilot",
      id: agentId,
      input: { type: "chat.message", message: payload.message, firmSlug, browserSessionId },
    });
    logLeadPilotEvent("chat.dispatched", { firmSlug, dispatchId: receipt.dispatchId });
    return c.json(
      {
        ok: true,
        dispatchId: receipt.dispatchId,
        acceptedAt: receipt.acceptedAt,
        streamUrl,
        agentId,
        instruction: `Use GET ${streamUrl}?offset=-1&live=sse to stream`,
      },
      201,
    );
  } catch (error) {
    logLeadPilotEvent("chat.error", { error: error instanceof Error ? error.message : String(error) }, "error");
    return c.json({ error: "dispatch_failed", message: "Failed to dispatch." }, 500);
  }
});

app.route("/", flue());
export default app;
