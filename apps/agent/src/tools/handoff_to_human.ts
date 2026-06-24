import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { appendConversationEvent } from "@leadpilot/db";
import { requireSessionBinding } from "../agent/lib/session-scope.ts";

export function createHandoffToHumanTool(firmSlug: string, browserSessionId: string) {
  return defineTool({
    name: "handoff_to_human",
    description: "Flag a conversation for human staff review.",
    input: v.object({ reason: v.pipe(v.string(), v.minLength(1)), urgency: v.optional(v.picklist(["normal","high"]), "normal") }),
    async run({ input }: { input: { reason: string; urgency: string } }) {
      const binding = await requireSessionBinding(firmSlug, browserSessionId);
      await appendConversationEvent({ firmId: binding.firmId, conversationId: binding.conversationId, eventType: "handoff.requested", payload: { reason: input.reason, urgency: input.urgency } });
      return JSON.parse(JSON.stringify({ recorded: true }));
    },
  });
}
