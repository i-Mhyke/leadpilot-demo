import type { FirmAgentProfile } from "@leadpilot/shared";

export function firmProfileContextForModel(profile: FirmAgentProfile): string[] {
  const serviceSummary = profile.services
    .map((service) => `${service.name} (${service.slug})`)
    .join("; ");
  return [
    "Firm profile (already loaded for this turn — do not call get_firm_profile unless the visitor asks about fees, thresholds, or a service not listed here).",
    `Firm name: ${profile.firm.name}`,
    `Visitor-facing company name: ${profile.firm.name}. Use this exact name in replies instead of generic labels.`,
    `Industry: ${profile.firm.industry}`,
    `Jurisdiction: ${profile.firm.jurisdiction}`,
    `Services: ${serviceSummary || "none configured"}`,
    `Preferred greeting: ${profile.toneProfile.preferredGreeting}`,
    `Voice: ${profile.toneProfile.voice}`,
    `Contact capture threshold: ${profile.bookingPolicy.contactCaptureThreshold}`,
    `Booking offer threshold: ${profile.bookingPolicy.bookingOfferThreshold}`,
    `Required contact fields: ${profile.bookingPolicy.requiredContactFields.join(", ") || "none"}`,
    `Can discuss fees: ${profile.pricingPolicy.canDiscussFees ? "yes" : "no"}`,
    profile.pricingPolicy.feeSummary ? `Fee summary: ${profile.pricingPolicy.feeSummary}` : "",
  ].filter(Boolean);
}
