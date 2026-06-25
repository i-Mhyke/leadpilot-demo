import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { normalizeLeadScoreFactors } from "@leadpilot/domain";
import { getFirmBookingPolicy } from "@leadpilot/db";
import { resolveLeadQualification } from "../agent/lib/lead-qualification.ts";
import { requireSessionBinding } from "../agent/lib/session-scope.ts";

function r(v: unknown) { return JSON.parse(JSON.stringify(v)); }

const sf = v.object({
  serviceFit: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
  urgency: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
  specificity: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
  commercialValue: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
  readiness: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
  contactConfidence: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
});

export function createEvaluateConversationReadinessTool(firmSlug: string, browserSessionId: string) {
  return defineTool({
    name: "evaluate_conversation_readiness",
    description: "Evaluate readiness for contact capture or booking.",
    input: v.object({
      scoreFactors: sf,
      explicitHelpIntent: v.optional(v.boolean()),
      highUrgency: v.optional(v.boolean()),
    }),
    async run({ input }: { input: Record<string, unknown> }) {
      const binding = await requireSessionBinding(firmSlug, browserSessionId);
      const bp = await getFirmBookingPolicy(binding.firmId);
      const result = resolveLeadQualification({
        scoreFactors: normalizeLeadScoreFactors(input.scoreFactors as Record<string, number>),
        contactCaptureThreshold: bp.contactCaptureThreshold,
        bookingOfferThreshold: bp.bookingOfferThreshold,
        explicitHelpIntent: input.explicitHelpIntent as boolean | undefined,
        highUrgency: input.highUrgency as boolean | undefined,
      });
      return r({
        score: result.score, temperature: result.temperature,
        nextAction: result.nextAction, conversationPhase: result.conversationPhase,
      });
    },
  });
}
