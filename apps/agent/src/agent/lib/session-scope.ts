import { getSessionBinding, resolveBinding } from "./persistence.ts";

export function rejectMismatchedScope(hint: { firmId?: string; conversationId?: string }, binding: { firmId: string; conversationId: string }): void {
  if (hint.firmId && hint.firmId !== binding.firmId) {
    throw new SessionScopeError(`Scope mismatch: firmId ${hint.firmId} does not match binding ${binding.firmId}`);
  }
  if (hint.conversationId && hint.conversationId !== binding.conversationId) {
    throw new SessionScopeError(`Scope mismatch: conversationId ${hint.conversationId} does not match binding ${binding.conversationId}`);
  }
}
export async function requirePublicSessionBinding(firmSlug: string, browserSessionId: string) {
  return requireSessionBinding(firmSlug, browserSessionId);
}

export class SessionScopeError extends Error {
  constructor(message: string) { super(message); this.name = "SessionScopeError"; }
}

export async function requireSessionBinding(firmSlug: string, browserSessionId: string) {
  const agentInstanceId = `${firmSlug}/${browserSessionId}`;
  let binding = getSessionBinding(agentInstanceId);
  if (!binding) binding = await resolveBinding(firmSlug, browserSessionId, agentInstanceId);
  return { ...binding, agentInstanceId };
}
