import { defineAgentProfile, defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { listRecentConversations, createContentRecommendations } from "@leadpilot/db";
import { requireStaffFirmId } from "../../agent/lib/staff-scope.ts";

const getRecentConversationsTool = defineTool({
  name: "get_recent_conversations",
  description: "Fetch recent conversations for the staff-authenticated firm.",
  input: v.object({ from: v.optional(v.string()), to: v.optional(v.string()), limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(200)), 50) }),
  async run({ input }: { input: Record<string, unknown> }) {
    const firmId = await requireStaffFirmId();
    const i = input as Record<string, string|number|undefined>;
    const conversations = await listRecentConversations({ firmId, from: i.from as string, to: i.to as string, limit: (i.limit as number) || 50 });
    return JSON.parse(JSON.stringify({ count: conversations.length }));
  },
});

const saveRecsTool = defineTool({
  name: "save_content_recommendations",
  description: "Persist draft content recommendations.",
  input: v.object({ insightRunId: v.optional(v.string()), recommendations: v.pipe(v.array(v.object({ topic: v.pipe(v.string(), v.minLength(1)), format: v.picklist(["linkedin_post","blog_post","email_sequence","video_brief","report"]), title: v.pipe(v.string(), v.minLength(1)), rationale: v.pipe(v.string(), v.minLength(1)), sourceConversationCount: v.pipe(v.number(), v.minValue(1)), draft: v.optional(v.string()) })), v.minLength(1)) }),
  async run({ input }: { input: { insightRunId?: string; recommendations: Array<Record<string, unknown>> } }) {
    const firmId = await requireStaffFirmId();
    const saved = await createContentRecommendations(firmId, input.recommendations as any);
    return JSON.parse(JSON.stringify({ savedCount: saved.length, status: "draft" }));
  },
});

export const conversationAnalystProfile = defineAgentProfile({
  name: "conversation_analyst",
  description: "Analyzes conversation transcripts for topics and content signals.",
  instructions: "Analyze transcripts. Extract topics, urgency (low/medium/high), lead readiness (cold/warm/hot), and content opportunities. Return JSON.",
  tools: [getRecentConversationsTool, saveRecsTool],
});
