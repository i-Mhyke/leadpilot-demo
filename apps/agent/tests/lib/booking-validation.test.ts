import { describe, expect, it } from "vitest";
import { missingBookingFields } from "../../src/agent/lib/booking-validation.ts";

describe("missingBookingFields", () => {
  it("requires a preferred booking datetime for a new booking request", () => {
    const missing = missingBookingFields(
      {
        visitorName: "Maren",
        visitorEmail: "maren@example.com",
        visitorPhone: undefined,
        companyName: undefined,
        preferredBookingAt: undefined,
        matterSummary: "SAFE note fundraising",
      },
      ["name", "email"],
    );

    expect(missing).toContain("preferred_booking_at");
  });

  it("does not require a preferred booking datetime when the booking already has one", () => {
    const missing = missingBookingFields(
      {
        visitorName: "Maren",
        visitorEmail: "maren@example.com",
        visitorPhone: undefined,
        companyName: undefined,
        preferredBookingAt: undefined,
        matterSummary: "SAFE note fundraising",
      },
      ["name", "email"],
      { requirePreferredBookingAt: false },
    );

    expect(missing).not.toContain("preferred_booking_at");
  });
});
