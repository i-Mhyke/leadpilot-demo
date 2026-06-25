import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEvaluateConversationReadinessTool } from "../../src/tools/evaluate_conversation_readiness.ts";

const requireSessionBinding = vi.fn();
const getFirmBookingPolicy = vi.fn();

vi.mock("../../src/agent/lib/session-scope.ts", () => ({
  requireSessionBinding: (...args: unknown[]) => requireSessionBinding(...args),
}));

vi.mock("@leadpilot/db", () => ({
  getFirmBookingPolicy: (...args: unknown[]) => getFirmBookingPolicy(...args),
}));

describe("evaluate_conversation_readiness tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSessionBinding.mockResolvedValue({
      firmId: "firm-1",
      firmSlug: "avance",
      conversationId: "conv-1",
      agentInstanceId: "avance/browser-1",
    });
    getFirmBookingPolicy.mockResolvedValue({
      contactCaptureThreshold: 55,
      bookingOfferThreshold: 70,
      requiredContactFields: ["name", "email"],
      bookingMode: "request_only",
      allowPhoneCapture: true,
    });
  });

  it("promotes contact capture when explicit help intent is present", async () => {
    const tool = createEvaluateConversationReadinessTool("avance", "browser-1");
    const result = await tool.run({
      input: {
        scoreFactors: {
          serviceFit: 0.1,
          urgency: 0.1,
          specificity: 0.1,
          commercialValue: 0.1,
          readiness: 0.1,
          contactConfidence: 0.1,
        },
        explicitHelpIntent: true,
      },
    });

    expect(result).toMatchObject({
      nextAction: "ask_for_contact",
      conversationPhase: "listen",
    });
  });
});
