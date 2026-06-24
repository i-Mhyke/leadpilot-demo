import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { recordConversationTopic } from "@leadpilot/db";
import { normalizeTopic } from "@leadpilot/domain";
import { requireSessionBinding } from "../agent/lib/session-scope.ts";

export function createRecordConversationTopicTool(firmSlug: string, browserSessionId: string) {
  return defineTool({
    name: "record_conversation_topic",
    description: "Record a normalized conversation topic for analytics.",
    input: v.object({ topic: v.pipe(v.string(), v.minLength(2)), serviceId: v.optional(v.string()), confidence: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(1))) }),
    async run({ input }: { input: { topic: string; serviceId?: string; confidence?: number } }) {
      const binding = await requireSessionBinding(firmSlug, browserSessionId);
      await recordConversationTopic({ firmId: binding.firmId, conversationId: binding.conversationId, topic: input.topic, normalizedTopic: normalizeTopic(input.topic), serviceId: input.serviceId, confidence: input.confidence });
      return JSON.parse(JSON.stringify({ recorded: true, normalizedTopic: normalizeTopic(input.topic) }));
    },
  });
}
