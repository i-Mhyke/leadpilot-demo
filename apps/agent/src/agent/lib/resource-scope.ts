import { getConversationWriteScope, resolveFirmServiceId } from "@leadpilot/db";

export async function resolveScopedServiceId(firmIdOrBinding: string | { firmId: string }, serviceId: string | undefined): Promise<string | undefined> {
  const firmId = typeof firmIdOrBinding === "string" ? firmIdOrBinding : firmIdOrBinding.firmId;
  if (!serviceId) return undefined;
  return resolveFirmServiceId(firmId, serviceId);
}

export async function resolveConversationWriteIds(firmIdOrBinding: string | { firmId?: string; conversationId?: string }, conversationIdArg?: string) {
  const fId = typeof firmIdOrBinding === 'string' ? firmIdOrBinding : (firmIdOrBinding as any).firmId ?? '';
  const cId = typeof firmIdOrBinding === 'string' ? (conversationIdArg ?? firmIdOrBinding) : (firmIdOrBinding as any).conversationId ?? '';
  return getConversationWriteScope(fId, cId);
}
