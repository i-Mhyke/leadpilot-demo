import type { FirmAgentProfile } from "@leadpilot/shared";
import { displayCountryName, isNigerianFirmCountry } from "./country.ts";

export function firmProfileContextForModel(profile: FirmAgentProfile): string[] {
  const serviceSummary = profile.services
    .map((service) => `${service.name} (${service.slug})`)
    .join("; ");
  const country = displayCountryName(profile.firm.jurisdiction);
  const canUseNigerianLegalKnowledge = isNigerianFirmCountry(profile.firm.jurisdiction);
  return [
    "Company profile (already loaded for this turn — do not call get_firm_profile unless the visitor asks about fees, thresholds, or a service not listed here).",
    `Company name: ${profile.firm.name}`,
    `Use this exact company name in replies instead of generic labels like \"the firm\".`,
    `Industry: ${profile.firm.industry}`,
    `Country: ${country}`,
    `Nigerian legal KB access: ${canUseNigerianLegalKnowledge ? "allowed" : "disabled"}`,
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
