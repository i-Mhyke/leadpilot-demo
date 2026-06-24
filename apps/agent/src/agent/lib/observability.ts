const SERVICE_NAME = "leadpilot-flue-agent";
const REDACTED_KEYS = new Set(["query","message","text","email","phone","name","visitorName","visitorEmail","visitorPhone","matterSummary","leadBrief","summary","reason"]);

export function isLeadPilotObservabilityEnabled(): boolean {
  return process.env.LEADPILOT_OBSERVABILITY !== "false";
}

export function sanitizeObservabilityPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue;
    sanitized[REDACTED_KEYS.has(key) ? key : key] = REDACTED_KEYS.has(key) ? "[redacted]" : value;
  }
  return sanitized;
}

export function logLeadPilotEvent(event: string, payload: Record<string, unknown> = {}, level: "info"|"warn"|"error" = "info") {
  if (!isLeadPilotObservabilityEnabled()) return;
  process.stderr.write(JSON.stringify({ ts: new Date().toISOString(), level, service: SERVICE_NAME, event, ...sanitizeObservabilityPayload(payload) }) + "\n");
}

export function recordLeadPilotMetric(name: string, _value = 1, _attributes: Record<string, string|number|boolean> = {}) {
  if (!isLeadPilotObservabilityEnabled()) return;
}

export async function withLeadPilotSpan<T>(_name: string, _correlation: Record<string, unknown>, fn: () => Promise<T>): Promise<T> {
  return fn();
}
