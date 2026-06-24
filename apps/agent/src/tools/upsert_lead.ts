import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { upsertLeadProfile, getFirmBookingPolicy } from "@leadpilot/db";
import { calculateLeadScore, classifyLeadTemperature, normalizeLeadScoreFactors } from "@leadpilot/domain";
import { resolveLeadQualification, shouldPersistLead } from "../agent/lib/lead-qualification.ts";
import { requireSessionBinding } from "../agent/lib/session-scope.ts";
import { resolveConversationWriteIds, resolveScopedServiceId } from "../agent/lib/resource-scope.ts";
import { deriveWriteIdempotencyKey } from "../agent/lib/write-idempotency.ts";

function r(v: unknown) { return JSON.parse(JSON.stringify(v)); }

const sf = v.object({
  serviceFit: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
  urgency: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
  specificity: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
  commercialValue: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
  readiness: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
  contactConfidence: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
});

export function createUpsertLeadTool(firmSlug: string, browserSessionId: string) {
  return defineTool({
    name: "upsert_lead",
    description: "Create or update a CRM lead.",
    input: v.object({
      name: v.optional(v.string()),
      email: v.optional(v.pipe(v.string(), v.email())),
      phone: v.optional(v.string()),
      companyName: v.optional(v.string()),
      primaryServiceId: v.optional(v.string()),
      summary: v.pipe(v.string(), v.minLength(1)),
      scoreFactors: sf,
      reason: v.pipe(v.string(), v.minLength(1)),
      explicitHelpIntent: v.optional(v.boolean()),
      highUrgency: v.optional(v.boolean()),
    }),
    async run({ input }: { input: Record<string, unknown> }) {
      const binding = await requireSessionBinding(firmSlug, browserSessionId);
      const ws = await resolveConversationWriteIds(binding.firmId, binding.conversationId);
      const psu = await resolveScopedServiceId(binding.firmId, input.primaryServiceId as string);
      const factors = normalizeLeadScoreFactors(input.scoreFactors as Record<string, number>);
      const score = calculateLeadScore(factors);
      const temp = classifyLeadTemperature(score);
      const bp = await getFirmBookingPolicy(binding.firmId);
      const qual = resolveLeadQualification({
        scoreFactors: factors,
        contactCaptureThreshold: bp.contactCaptureThreshold,
        bookingOfferThreshold: bp.bookingOfferThreshold,
        explicitHelpIntent: input.explicitHelpIntent as boolean | undefined,
        highUrgency: input.highUrgency as boolean | undefined,
      });
      if (!shouldPersistLead(qual.nextAction)) {
        return r({ score, temperature: temp, nextAction: qual.nextAction, persisted: false });
      }
      const i = input as Record<string, string | undefined>;
      const key = deriveWriteIdempotencyKey({
        firmId: binding.firmId, conversationId: binding.conversationId,
        toolName: "upsert_lead",
        canonicalInput: JSON.stringify({ summary: i.summary, score, temperature: temp }),
      });
      const lead = await upsertLeadProfile({
        firmId: binding.firmId, conversationId: binding.conversationId,
        visitorId: ws.visitorId, name: i.name, email: i.email, phone: i.phone,
        companyName: i.companyName, summary: i.summary || "", primaryServiceId: psu,
        score, temperature: temp, scoreFactors: factors, reason: i.reason || "",
        idempotencyKey: key,
      });
      return r({
        leadId: lead.id, score, temperature: temp, status: lead.status,
        nextAction: qual.nextAction, persisted: true,
      });
    },
  });
}
