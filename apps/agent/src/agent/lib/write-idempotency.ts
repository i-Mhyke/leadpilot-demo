import { createHash } from "node:crypto";

export function deriveWriteIdempotencyKey(input: {
  firmId: string; conversationId: string; turnId?: string; toolName: string; canonicalInput?: string;
}): string {
  if (input.turnId) return `${input.firmId}:${input.conversationId}:${input.turnId}:${input.toolName}`;
  const digest = createHash("sha256").update(`${input.firmId}:${input.conversationId}:${input.toolName}:${input.canonicalInput ?? ""}`).digest("hex");
  return `${input.firmId}:${input.conversationId}:${digest}`;
}
