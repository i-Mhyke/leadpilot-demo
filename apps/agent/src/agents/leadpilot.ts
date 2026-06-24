import { defineAgent, type AgentRouteHandler } from '@flue/runtime';
import type { FirmAgentProfile, FirmBrainSnapshot } from "@leadpilot/shared";
import { getFirmProfileBySlug } from "@leadpilot/db";
import { resolveModelSpecifier, resolveThinkingLevel } from "../agent/lib/model.ts";
import { parseClientContextHeader } from "../agent/lib/client-context.ts";
import { resolveBinding, getSessionBinding } from "../agent/lib/persistence.ts";
import { logLeadPilotEvent } from "../agent/lib/observability.ts";
import { composeLeadPilotInstructions } from "../agent/lib/leadpilot-instructions.ts";
import instructions from "../agent/instructions.md" with { type: 'markdown' };
import { createUpsertLeadTool } from "../tools/upsert_lead.ts";
import { createBookingRequestTool } from "../tools/create_booking_request.ts";
import { createSearchKnowledgeTool } from "../tools/search_knowledge.ts";
import { createGetFirmProfileTool } from "../tools/get_firm_profile.ts";
import { createEvaluateConversationReadinessTool } from "../tools/evaluate_conversation_readiness.ts";
import { createHandoffToHumanTool } from "../tools/handoff_to_human.ts";
import { createRecordConversationTopicTool } from "../tools/record_conversation_topic.ts";

export const description = 'LeadPilot intake assistant for law firms.';

export const route: AgentRouteHandler = async (c, next) => {
  const clientContext = parseClientContextHeader(c.req.raw);
  logLeadPilotEvent("agent.route.request", {
    firmSlug: clientContext?.firmSlug ?? 'from-id',
    hasHeader: Boolean(clientContext?.firmSlug),
  });
  await next();
};

export default defineAgent(async ({ id }) => {
  const parts = id.split('/');
  const firmSlug = parts[0] || '';
  const browserSessionId = parts.slice(1).join('/') || '';
  if (!firmSlug) return { model: resolveModelSpecifier(), instructions: 'No firm context provided.' };

  logLeadPilotEvent("agent.init", { firmSlug, browserSessionId });

  let profile: FirmAgentProfile | null = null;
  try {
    const result = await getFirmProfileBySlug(firmSlug);
    if (!('kind' in result)) profile = result;
  } catch {}

  let brainSnapshot: FirmBrainSnapshot | null = null;
  try {
    const cached = getSessionBinding(id);
    const binding = cached?.brainSnapshot ? cached : await resolveBinding(firmSlug, browserSessionId, id);
    brainSnapshot = binding.brainSnapshot ?? null;
  } catch (err) {
    logLeadPilotEvent("agent.init.bindingError", {
      firmSlug, browserSessionId, instanceId: id,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const fullInstructions = composeLeadPilotInstructions({
    baseInstructions: instructions,
    profile,
    brainSnapshot,
  });

  return {
    model: resolveModelSpecifier(),
    thinkingLevel: resolveThinkingLevel(),
    instructions: fullInstructions,
    tools: [
      createUpsertLeadTool(firmSlug, browserSessionId),
      createBookingRequestTool(firmSlug, browserSessionId),
      createSearchKnowledgeTool(firmSlug, browserSessionId),
      createGetFirmProfileTool(firmSlug),
      createEvaluateConversationReadinessTool(firmSlug, browserSessionId),
      createHandoffToHumanTool(firmSlug, browserSessionId),
      createRecordConversationTopicTool(firmSlug, browserSessionId),
    ],
  };
});
