import { defineTool } from '@flue/runtime';
import { createBookingRequest, getFirmBookingPolicy } from "@leadpilot/db";
import { bookingInputSchema, missingBookingFields } from "../agent/lib/booking-validation.ts";
import { requireSessionBinding } from "../agent/lib/session-scope.ts";
import { resolveConversationWriteIds, resolveScopedServiceId } from "../agent/lib/resource-scope.ts";
import { deriveWriteIdempotencyKey } from "../agent/lib/write-idempotency.ts";

function r(v: unknown) { return JSON.parse(JSON.stringify(v)); }

export function createBookingRequestTool(firmSlug: string, browserSessionId: string) {
  return defineTool({
    name: "create_booking_request",
    description: "Create or update an internal booking request after upsert_lead succeeds.",
    input: bookingInputSchema,
    async run({ input }: { input: Record<string, unknown> }) {
      const binding = await requireSessionBinding(firmSlug, browserSessionId);
      const writeScope = await resolveConversationWriteIds(binding.firmId, binding.conversationId);
      const bookingPolicy = await getFirmBookingPolicy(binding.firmId);
      const i = input as Record<string, string | undefined>;
      const missing = missingBookingFields(i as any, bookingPolicy.requiredContactFields);
      if (missing.length > 0) return r({ ok: false, status: "needs_more_info", missingFields: missing });
      if (!writeScope.leadId) return r({ ok: false, status: "needs_lead" });
      const serviceId = await resolveScopedServiceId(binding.firmId, i.serviceId);
      const key = deriveWriteIdempotencyKey({
        firmId: binding.firmId, conversationId: binding.conversationId,
        toolName: "create_booking_request",
        canonicalInput: JSON.stringify({ leadId: writeScope.leadId, serviceId }),
      });
      await createBookingRequest({
        firmId: binding.firmId, conversationId: binding.conversationId,
        leadId: writeScope.leadId, visitorId: writeScope.visitorId, serviceId,
        visitorName: i.visitorName, visitorEmail: i.visitorEmail,
        visitorPhone: i.visitorPhone, companyName: i.companyName,
        preferredTimeText: i.preferredTimeText,
        matterSummary: i.matterSummary || "", leadBrief: i.matterSummary || "",
        idempotencyKey: key,
      });
      return r({ ok: true, status: "captured", appointmentConfirmed: false });
    },
  });
}
