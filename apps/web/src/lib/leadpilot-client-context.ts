export const LEADPILOT_CLIENT_CONTEXT_HEADER = "x-leadpilot-client-context";

export function buildClientContextPayload(input: {
  firmSlug: string;
  browserSessionId: string;
  localConversationId?: string;
  sourceUrl?: string;
}) {
  return {
    firmSlug: input.firmSlug,
    browserSessionId: input.browserSessionId,
    localConversationId: input.localConversationId,
    sourceUrl: input.sourceUrl,
  };
}
