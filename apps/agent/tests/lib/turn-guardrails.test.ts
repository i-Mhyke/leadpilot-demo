import { describe, expect, it } from "vitest";
import {
  alertTurnStepBudgetExceeded,
  classifyTurnStepBudget,
  EMERGENCY_MODEL_MESSAGE_MAX,
} from "../../src/agent/lib/turn-guardrails.ts";

describe("turn-guardrails", () => {
  it("treats one model message as normal for zero-tool turns", () => {
    expect(classifyTurnStepBudget(1)).toBe("zero_tool");
  });

  it("treats two model messages as normal after one tool phase", () => {
    expect(classifyTurnStepBudget(2)).toBe("tool_backed");
  });

  it("flags overflow at the emergency maximum", () => {
    expect(classifyTurnStepBudget(EMERGENCY_MODEL_MESSAGE_MAX)).toBe("overflow");
    expect(() =>
      alertTurnStepBudgetExceeded({
        sessionId: "sess-1",
        turnId: "turn-1",
        modelMessageCount: EMERGENCY_MODEL_MESSAGE_MAX,
      }),
    ).not.toThrow();
  });
});
