import { describe, expect, it } from "vitest";
import { resolveLeadContact } from "./lead-contact";

describe("resolveLeadContact", () => {
  it("prefers visitor name and keeps email visible", () => {
    const contact = resolveLeadContact({
      visitorId: "visitor-abc12345",
      visitorName: "Maren Okonkwo",
      visitorEmail: "maren@northline.io",
    });

    expect(contact.displayName).toBe("Maren Okonkwo");
    expect(contact.email).toBe("maren@northline.io");
    expect(contact.contactCaptured).toBe(true);
  });

  it("falls back to email when name is missing", () => {
    const contact = resolveLeadContact({
      visitorId: "visitor-abc12345",
      visitorEmail: "maren@northline.io",
    });

    expect(contact.displayName).toBe("maren@northline.io");
    expect(contact.contactCaptured).toBe(true);
  });

  it("shows visitor id with uncaptured tag when contact is missing", () => {
    const contact = resolveLeadContact({
      visitorId: "visitor-abc12345",
    });

    expect(contact.displayName).toBe("Visitor visitor-");
    expect(contact.contactCaptured).toBe(false);
    expect(contact.visitorRef).toBe("visitor-");
  });

  it("uses booking contact fields when visitor fields are empty", () => {
    const contact = resolveLeadContact({
      visitorId: "visitor-abc12345",
      booking: {
        visitorName: "Amara Ibe",
        visitorEmail: "amara@example.com",
      },
    });

    expect(contact.displayName).toBe("Amara Ibe");
    expect(contact.email).toBe("amara@example.com");
    expect(contact.contactCaptured).toBe(true);
  });
});
