import { describe, expect, it } from "vitest";
import {
  assertConversationQuality,
  findAppointmentConfirmedWording,
  findEarlyContactCaptureWording,
  findForbiddenInternalWording,
} from "../../src/agent/lib/conversation-quality.ts";
import { shouldPersistLead } from "../../src/agent/lib/lead-qualification.ts";

describe("conversation quality checks", () => {
  it("flags internal session wording", () => {
    expect(findForbiddenInternalWording("We need to check internal policy first.")).toBeTruthy();
  });

  it("flags appointment confirmation language", () => {
    expect(findAppointmentConfirmedWording("Your appointment is confirmed.")).toBeTruthy();
  });

  it("flags early contact capture", () => {
    expect(findEarlyContactCaptureWording("I can send details by email if you ask")).toBeTruthy();
  });

  it("passes a clean resume reply", () => {
    expect(() =>
      assertConversationQuality(
        "I don't have enough context in this thread to safely pick up the earlier details. Tell me the matter in one sentence and I'll continue from there.",
        {
          forbidInternalWording: true,
          maxQuestions: 1,
        },
      ),
    ).not.toThrow();
  });

  it("flags em dash wording", () => {
    expect(() =>
      assertConversationQuality("This is worth a review — tell me more.", {
        forbidEmDash: true,
      }),
    ).toThrow(/em_dash/i);
  });
});

describe("shouldPersistLead", () => {
  it("only persists contact-ready or booking-ready matters", () => {
    expect(shouldPersistLead("continue_qualification")).toBe(false);
    expect(shouldPersistLead("ask_for_contact")).toBe(true);
    expect(shouldPersistLead("offer_booking")).toBe(true);
  });
});
