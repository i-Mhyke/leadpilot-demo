import { describe, expect, it } from "vitest";
import {
  toLeadSaveModelOutput,
  toBookingResultModelOutput,
  toReadinessModelOutput,
  resolveLeadQualification,
  shouldPersistLead,
  formatBookingFailureModelOutput,
  formatBookingSuccessModelOutput,
} from "../../src/agent/lib/lead-qualification.ts";

const lowScoreFactors = {
  serviceFit: 0.2, urgency: 0.2, specificity: 0.2,
  commercialValue: 0.2, readiness: 0.2, contactConfidence: 0.2,
};

const contactScoreFactors = {
  serviceFit: 0.55, urgency: 0.55, specificity: 0.55,
  commercialValue: 0.55, readiness: 0.55, contactConfidence: 0.55,
};

const bookingScoreFactors = {
  serviceFit: 0.9, urgency: 0.9, specificity: 0.8,
  commercialValue: 0.7, readiness: 0.9, contactConfidence: 0.8,
};

describe("resolveLeadQualification", () => {
  it("returns continue_qualification below contact threshold", () => {
    const result = resolveLeadQualification({ scoreFactors: lowScoreFactors, contactCaptureThreshold: 55, bookingOfferThreshold: 70 });
    expect(result.nextAction).toBe("continue_qualification");
    expect(result.shouldRequestContact).toBe(false);
  });

  it("returns ask_for_contact at contact threshold", () => {
    const result = resolveLeadQualification({ scoreFactors: contactScoreFactors, contactCaptureThreshold: 55, bookingOfferThreshold: 70 });
    expect(result.nextAction).toBe("ask_for_contact");
    expect(result.shouldRequestContact).toBe(true);
  });

  it("returns offer_booking at booking threshold", () => {
    const result = resolveLeadQualification({ scoreFactors: bookingScoreFactors, contactCaptureThreshold: 55, bookingOfferThreshold: 70 });
    expect(result.nextAction).toBe("offer_booking");
  });

  it("promotes to ask_for_contact when explicit help intent is present", () => {
    const result = resolveLeadQualification({
      scoreFactors: lowScoreFactors, contactCaptureThreshold: 55, bookingOfferThreshold: 70,
      explicitHelpIntent: true,
    });
    expect(result.nextAction).toBe("ask_for_contact");
  });

  it("prefers offer_booking over ask_for_contact", () => {
    const result = resolveLeadQualification({
      scoreFactors: bookingScoreFactors, contactCaptureThreshold: 55, bookingOfferThreshold: 70,
      explicitHelpIntent: true, highUrgency: true,
    });
    expect(result.nextAction).toBe("offer_booking");
  });
});

describe("shouldPersistLead", () => {
  it("only persists contact-ready or booking-ready matters", () => {
    expect(shouldPersistLead("continue_qualification")).toBe(false);
    expect(shouldPersistLead("ask_for_contact")).toBe(true);
    expect(shouldPersistLead("offer_booking")).toBe(true);
  });
});

describe("model output helpers", () => {
  it("formats lead save output", () => {
    const out = toLeadSaveModelOutput({ nextAction: "offer_booking", score: 80, temperature: "hot" });
    expect(out).toContain("Lead saved");
    expect(out).toContain("offer_booking");
  });

  it("formats booking success output", () => {
    const out = toBookingResultModelOutput({ bookingRequestId: "br-1", status: "pending", nextAction: "wait" });
    expect(out).toContain("Booking request captured");
  });

  it("formats booking failure output", () => {
    const out = toBookingResultModelOutput({ status: "failed", nextAction: "ask_for_contact" });
    expect(out).toContain("Booking request not captured");
  });

  it("formats readiness output", () => {
    const out = toReadinessModelOutput({ phase: "qualify", nextAction: "ask_for_contact" });
    expect(out).toContain("Next action:");
  });

  it("formats booking failure output with human-readable datetime labels", () => {
    const out = formatBookingFailureModelOutput(["preferred_booking_at", "company_name"]);
    expect(out).toContain("preferred booking date and time");
    expect(out).toContain("company name");
  });

  it("prompts for optional context after booking capture", () => {
    const out = formatBookingSuccessModelOutput({
      optionalFieldsMissing: {
        phone: true,
        preferredTime: false,
      },
    });
    expect(out).toContain("company name");
    expect(out).toContain("phone number");
    expect(out).toContain("urgency");
  });
});
