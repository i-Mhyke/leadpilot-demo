import * as v from "valibot";

export const bookingInputSchema = v.object({
  serviceId: v.optional(v.string()),
  routingGroup: v.optional(v.string()),
  visitorName: v.optional(v.string()),
  visitorEmail: v.optional(v.pipe(v.string(), v.email())),
  visitorPhone: v.optional(v.string()),
  companyName: v.optional(v.string()),
  preferredTimeText: v.optional(v.string()),
  matterSummary: v.pipe(v.string(), v.minLength(1)),
  leadBrief: v.pipe(v.string(), v.minLength(1)),
  urgency: v.optional(v.string()),
  sourceUrl: v.optional(v.string()),
});

export type BookingInput = v.InferOutput<typeof bookingInputSchema>;

export function missingBookingFields(input: Pick<BookingInput, "visitorName" | "visitorEmail" | "visitorPhone" | "matterSummary" | "companyName">, requiredContactFields: string[]): string[] {
  const required = new Set(requiredContactFields);
  const missing: string[] = [];
  if (required.has("name") && !input.visitorName) missing.push("name");
  if (required.has("email") && !input.visitorEmail) missing.push("email");
  if (required.has("phone") && !input.visitorPhone) missing.push("phone");
  if (required.has("company_name") && !input.companyName) missing.push("company_name");
  return missing;
}
