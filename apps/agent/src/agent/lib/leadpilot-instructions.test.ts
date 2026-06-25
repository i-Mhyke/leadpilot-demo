import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { FirmAgentProfile, FirmBrainSnapshot } from "@leadpilot/shared";
import { composeLeadPilotInstructions } from "./leadpilot-instructions.ts";

const sampleProfile: FirmAgentProfile = {
  firm: {
    id: "firm-1",
    name: "Northline Advisory",
    slug: "northline-advisory",
    industry: "consulting",
    jurisdiction: "Nigeria",
    status: "active",
  },
  services: [],
  bookingPolicy: {
    bookingMode: "request_only",
    contactCaptureThreshold: 55,
    bookingOfferThreshold: 70,
    requiredContactFields: ["name", "email", "matter_summary"],
    allowPhoneCapture: true,
  },
  pricingPolicy: {
    canDiscussFees: false,
    requiresHumanForFeeQuestions: true,
  },
  toneProfile: {
    voice: "warm_professional",
    formalityLevel: "balanced",
    preferredGreeting: "Hi, I'm the intake assistant for Northline Advisory.",
    avoidPhrases: [],
  },
};

const sampleBrain: FirmBrainSnapshot = {
  revision: 4,
  contentHash: "abc123def456",
  compiledAt: "2026-06-24T00:00:00.000Z",
  compiled: {
    businessSummary: "Northline Advisory is a consulting firm.",
    tone: {
      voice: "warm and direct",
      formalityLevel: "balanced",
      preferredGreeting: "Hi, I'm the intake assistant for Northline Advisory.",
      notes: ["Avoid jargon"],
    },
    greeting: "Open with a short welcome and one question.",
    qualificationPosture: ["Ask for the business issue first."],
    escalationRules: ["Escalate legal issues to a human."],
    forbiddenClaims: ["Never promise outcomes."],
    serviceEmphasis: ["Lead qualification", "Booking requests"],
  },
};

describe("composeLeadPilotInstructions", () => {
  it("keeps the base instructions intact and injects firm and brain context in order", () => {
    const instructions = composeLeadPilotInstructions({
      baseInstructions: "BASE INSTRUCTIONS",
      profile: sampleProfile,
      brainSnapshot: sampleBrain,
    });

    expect(instructions.startsWith("BASE INSTRUCTIONS")).toBe(true);
    expect(instructions).toContain("## Injected Company Context");
    expect(instructions).toContain("## Injected Legal Policy");
    expect(instructions).toContain("## Injected Brain Context");
    expect(instructions).toContain("Company name: Northline Advisory");
    expect(instructions).toContain("Brain revision: 4");
    expect(instructions).toContain("Forbidden claims: Never promise outcomes.");
    expect(instructions).toContain("Legal retrieval policy: Nigerian legal KB enabled for this firm.");
  });

  it("falls back to the generic instructions and firm profile when the brain is missing", () => {
    const instructions = composeLeadPilotInstructions({
      baseInstructions: "BASE INSTRUCTIONS",
      profile: sampleProfile,
      brainSnapshot: null,
    });

    expect(instructions).toContain("BASE INSTRUCTIONS");
    expect(instructions).toContain("## Injected Company Context");
    expect(instructions).toContain("## Injected Legal Policy");
    expect(instructions).not.toContain("## Injected Brain Context");
  });

  it("disables Nigerian legal retrieval for non-Nigerian firms", () => {
    const instructions = composeLeadPilotInstructions({
      baseInstructions: "BASE INSTRUCTIONS",
      profile: {
        ...sampleProfile,
        firm: {
          ...sampleProfile.firm,
          jurisdiction: "Finland",
        },
      },
      brainSnapshot: null,
    });

    expect(instructions).toContain("Legal retrieval policy: Nigerian legal KB disabled for this firm.");
    expect(instructions).toContain('Never call `search_knowledge` with scope "legal" or "both".');
  });

  it("includes the booking schedule marker in the base prompt file", () => {
    const instructions = readFileSync(new URL("../instructions.md", import.meta.url), "utf8");
    expect(instructions).toContain("[[leadpilot.booking_schedule_requested]]");
  });

  it("documents the recoverable persistence failure fallback", () => {
    const instructions = readFileSync(new URL("../instructions.md", import.meta.url), "utf8");
    expect(instructions).toContain('failureReason: "persistence_unavailable"');
    expect(instructions).toContain("keep the conversation moving with the next useful question");
  });

  it("tells the agent to still capture out-of-scope matters", () => {
    const instructions = readFileSync(new URL("../instructions.md", import.meta.url), "utf8");
    expect(instructions).toContain("still capture the visitor's contact details");
    expect(instructions).toContain("Do not say it is a strong fit when it is not");
  });
});
