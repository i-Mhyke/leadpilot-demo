import { describe, expect, it } from "vitest";
import { firmProfileContextForModel } from "../../src/agent/lib/firm-context.ts";

describe("firmProfileContextForModel", () => {
  it("includes firm name and tells the model not to re-fetch the profile", () => {
    const lines = firmProfileContextForModel({
      firm: {
        id: "firm-1",
        slug: "demo-law",
        name: "E&C Legal",
        industry: "legal",
        jurisdiction: "NG",
        status: "active",
      },
      services: [
        {
          id: "svc-1",
          firmId: "firm-1",
          name: "Startup Law",
          slug: "startup-law",
          description: "Founder matters",
          visitorExamples: [],
          qualificationQuestions: [],
          urgencySignals: [],
          requiredBookingFields: [],
          routingGroup: "commercial",
          isActive: true,
        },
      ],
      bookingPolicy: {
        contactCaptureThreshold: 55,
        bookingOfferThreshold: 70,
        requiredContactFields: ["name", "email"],
        bookingMode: "request_only",
        allowPhoneCapture: true,
      },
      pricingPolicy: {
        canDiscussFees: false,
        feeSummary: "Custom quotes after review",
        feeDisclaimer: "",
        requiresHumanForFeeQuestions: true,
      },
      toneProfile: {
        voice: "warm",
        formalityLevel: "professional",
        preferredGreeting: "Hi, I'm the intake assistant for E&C Legal.",
        avoidPhrases: [],
      },
    });

    expect(lines.some((line) => line.includes("E&C Legal"))).toBe(true);
    expect(lines.some((line) => line.includes("do not call get_firm_profile"))).toBe(true);
    expect(lines.some((line) => line.includes("Startup Law"))).toBe(true);
  });
});
