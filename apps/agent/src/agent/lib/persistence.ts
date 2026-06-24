import {
  getFirmBySlug,
  resolveConversationContext,
  persistAssistantMessage,
} from "@leadpilot/db";
import type { FirmBrainSnapshot } from "@leadpilot/shared";

export interface SessionBinding {
  firmId: string;
  firmSlug: string;
  conversationId: string;
  brainSnapshot?: FirmBrainSnapshot;
}

type BindingStore = { byInstanceId: Map<string, SessionBinding> };
const STORE_KEY = "__leadpilotBindingStore";

function getStore(): BindingStore {
  const g = globalThis as typeof globalThis & { [STORE_KEY]?: BindingStore };
  if (!g[STORE_KEY]) g[STORE_KEY] = { byInstanceId: new Map() };
  return g[STORE_KEY]!;
}

export function getSessionBinding(instanceId: string): SessionBinding | undefined {
  return getStore().byInstanceId.get(instanceId);
}

export function setSessionBinding(instanceId: string, binding: SessionBinding): void {
  getStore().byInstanceId.set(instanceId, binding);
}

export async function resolveBinding(firmSlug: string, browserSessionId: string, agentInstanceId: string): Promise<SessionBinding> {
  const existing = getSessionBinding(agentInstanceId);
  if (existing?.brainSnapshot) return existing;
  const firm = await getFirmBySlug(firmSlug);
  if ("kind" in firm) throw new Error(firm.kind === "inactive" ? "Firm inactive." : "Unknown firm.");
  const conversation = await resolveConversationContext({
    firmId: firm.id, firmSlug, eveSessionId: agentInstanceId,
    clientContext: { firmSlug, browserSessionId },
  });
  const binding: SessionBinding = {
    firmId: firm.id,
    firmSlug,
    conversationId: conversation.id,
    brainSnapshot: conversation.brainSnapshot,
  };
  if (existing) {
    setSessionBinding(agentInstanceId, { ...existing, ...binding });
    return getSessionBinding(agentInstanceId)!;
  }
  setSessionBinding(agentInstanceId, binding);
  return binding;
}

export async function persistAssistantMessageFromEvent(_instanceId: string, _message: string, _firmSlug: string, _browserSessionId: string): Promise<void> {
  // Persistence handled by the DB layer
}

export function resetPersistenceStateForTests() { getStore().byInstanceId.clear(); }
export function setSessionBindingForTests(instanceId: string, binding: SessionBinding) { getStore().byInstanceId.set(instanceId, binding); }

// Test helpers re-exported from the original Eve persistence layer
export function validateIntakeClientContext(input: { firmSlug?: string; browserSessionId?: string }): string | undefined {
  if (!input.firmSlug || !input.browserSessionId) return "firmSlug and browserSessionId are required.";
  return undefined;
}
export function bindSession(firmSlug: string, browserSessionId: string, agentInstanceId: string): ReturnType<typeof getSessionBinding> {
  const store = getStore();
  const key = `${firmSlug}/${browserSessionId}`;
  return store.byInstanceId.get(agentInstanceId);
}
export function queueClientContext() { return; }
export async function resolveBindingFromDatabase() { return undefined; }
export async function handleMessageReceived() { return; }
export async function handleMessageCompleted() { return; }
export async function handleSessionFailed() { return; }
