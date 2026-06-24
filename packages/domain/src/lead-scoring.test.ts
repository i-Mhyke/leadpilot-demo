import { describe, expect, it } from "vitest";
import {
  calculateLeadScore,
  classifyLeadTemperature,
  evaluateConversationReadiness,
} from "./index.ts";

describe("lead scoring", () => {
  it("classifies cold curiosity", () => {
    const score = calculateLeadScore({
      serviceFit: 0.2,
      urgency: 0.1,
      specificity: 0.2,
      commercialValue: 0.1,
      readiness: 0.1,
      contactConfidence: 0,
    });
    expect(classifyLeadTemperature(score)).toBe("cold");
  });

  it("classifies hot qualified matter", () => {
    const score = calculateLeadScore({
      serviceFit: 0.9,
      urgency: 0.9,
      specificity: 0.8,
      commercialValue: 0.7,
      readiness: 0.9,
      contactConfidence: 0.8,
    });
    expect(classifyLeadTemperature(score)).toBe("hot");
  });

  it("increases booking readiness without inventing contact data", () => {
    const readiness = evaluateConversationReadiness({
      scoreFactors: {
        serviceFit: 0.9,
        urgency: 0.9,
        specificity: 0.8,
        commercialValue: 0.7,
        readiness: 0.8,
        contactConfidence: 0,
      },
      contactCaptureThreshold: 55,
      bookingOfferThreshold: 70,
    });

    expect(readiness.shouldOfferBooking).toBe(true);
    expect(readiness.shouldRequestContact).toBe(true);
  });
});
