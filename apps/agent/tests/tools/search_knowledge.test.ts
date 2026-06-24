import { describe, expect, it, vi, beforeEach } from "vitest";
import type { FirmAgentProfile } from "@leadpilot/shared";
import { createSearchKnowledgeTool } from "../../src/tools/search_knowledge.ts";

vi.mock("@leadpilot/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@leadpilot/db")>();
  return {
    ...actual,
    getFirmProfileBySlug: vi.fn(),
  };
});

vi.mock("@leadpilot/firm-rag", () => ({
  searchFirmKnowledge: vi.fn(),
}));

vi.mock("@leadpilot/legal-rag", () => ({
  searchLegalKnowledge: vi.fn(),
}));

vi.mock("../../src/agent/lib/session-scope.ts", () => ({
  requireSessionBinding: vi.fn(),
}));

import { getFirmProfileBySlug } from "@leadpilot/db";
import { searchFirmKnowledge } from "@leadpilot/firm-rag";
import { searchLegalKnowledge } from "@leadpilot/legal-rag";
import { requireSessionBinding } from "../../src/agent/lib/session-scope.ts";

const binding = {
  firmId: "firm-1",
  firmSlug: "demo-law",
  conversationId: "conv-1",
  agentInstanceId: "demo-law/browser-1",
};

const baseProfile: FirmAgentProfile = {
  firm: {
    id: "firm-1",
    name: "Northline Advisory",
    slug: "demo-law",
    industry: "consulting",
    jurisdiction: "Nigeria",
    status: "active",
  },
  services: [],
  bookingPolicy: {
    bookingMode: "request_only",
    contactCaptureThreshold: 55,
    bookingOfferThreshold: 70,
    requiredContactFields: ["name", "email"],
    allowPhoneCapture: true,
  },
  pricingPolicy: {
    canDiscussFees: false,
    requiresHumanForFeeQuestions: true,
  },
  toneProfile: {
    voice: "warm",
    formalityLevel: "professional",
    preferredGreeting: "Hi, I'm the intake assistant for Northline Advisory.",
    avoidPhrases: [],
  },
};

describe("search_knowledge tool", () => {
  beforeEach(() => {
    vi.mocked(requireSessionBinding).mockResolvedValue(binding);
    vi.mocked(searchFirmKnowledge).mockReset();
    vi.mocked(searchLegalKnowledge).mockReset();
    vi.mocked(getFirmProfileBySlug).mockReset();
  });

  it("uses the Nigerian legal KB only when the firm country is Nigeria", async () => {
    vi.mocked(getFirmProfileBySlug).mockResolvedValue(baseProfile);
    vi.mocked(searchFirmKnowledge).mockResolvedValue({
      status: "ok",
      results: [{ title: "Company overview", text: "Firm evidence." }],
    });
    vi.mocked(searchLegalKnowledge).mockResolvedValue({
      status: "ok",
      results: [{ citation: "Nigerian law", text: "Legal evidence." }],
    });

    const tool = createSearchKnowledgeTool("demo-law", "browser-1");
    await tool.run({
      input: {
        query: "startup compliance",
        scope: "both",
        limit: 4,
      },
    });

    expect(searchFirmKnowledge).toHaveBeenCalledTimes(1);
    expect(searchLegalKnowledge).toHaveBeenCalledTimes(1);
  });

  it("skips the Nigerian legal KB for non-Nigerian firms", async () => {
    vi.mocked(getFirmProfileBySlug).mockResolvedValue({
      ...baseProfile,
      firm: {
        ...baseProfile.firm,
        jurisdiction: "United Kingdom",
      },
    });
    vi.mocked(searchFirmKnowledge).mockResolvedValue({
      status: "ok",
      results: [{ title: "Company overview", text: "Firm evidence." }],
    });

    const tool = createSearchKnowledgeTool("demo-law", "browser-1");
    await tool.run({
      input: {
        query: "startup compliance",
        scope: "both",
        limit: 4,
      },
    });

    expect(searchFirmKnowledge).toHaveBeenCalledTimes(1);
    expect(searchLegalKnowledge).not.toHaveBeenCalled();
  });
});
