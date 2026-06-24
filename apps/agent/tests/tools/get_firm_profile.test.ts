import { describe, expect, it } from "vitest";

const PUBLIC_PROFILE_KEYS = new Set([
  "found",
  "firmName",
  "industry",
  "jurisdiction",
  "services",
  "contactCaptureThreshold",
  "bookingOfferThreshold",
  "requiredContactFields",
  "bookingMode",
  "pricing",
  "tone",
  "error",
]);

const INTERNAL_SERVICE_KEYS = new Set(["firmId", "isActive", "requiredBookingFields", "createdAt", "updatedAt"]);

describe("get_firm_profile output shape", () => {
  it("omits internal database-only fields from the tool contract", () => {
    const toolOutput = {
      found: true,
      firmName: "E&C Legal",
      industry: "legal",
      jurisdiction: "Nigeria",
      services: [
        {
          id: "svc-1",
          name: "Startup Advisory",
          slug: "startup-advisory",
          description: "Seed and startup support",
          visitorExamples: ["SAFE note"],
          qualificationQuestions: ["Incorporated?"],
          urgencySignals: ["deadline"],
          routingGroup: "corporate",
        },
      ],
      contactCaptureThreshold: 55,
      bookingOfferThreshold: 70,
      requiredContactFields: ["name", "email", "matter_summary"],
      bookingMode: "request_only",
      pricing: { canDiscussFees: false, requiresHumanForFeeQuestions: true },
      tone: { voice: "warm_professional", formalityLevel: "balanced", avoidPhrases: [] },
    };

    for (const key of Object.keys(toolOutput)) {
      expect(PUBLIC_PROFILE_KEYS.has(key)).toBe(true);
    }

    for (const service of toolOutput.services) {
      for (const key of Object.keys(service)) {
        expect(INTERNAL_SERVICE_KEYS.has(key)).toBe(false);
      }
    }
  });
});
