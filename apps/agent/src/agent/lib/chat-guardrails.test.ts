import { describe, expect, it } from "vitest";
import { ChatRequestGuardrailError, parseChatIngressPayload } from "./chat-guardrails.ts";

describe("chat guardrails", () => {
  it("accepts booking turns that only contain structured input responses", () => {
    expect(
      parseChatIngressPayload(
        {
          inputResponses: [{ type: "booking_datetime", preferredBookingAt: "2026-06-25T12:00:00.000Z" }],
        },
        { requireMessage: false },
      ),
    ).toEqual({
      inputResponses: [{ type: "booking_datetime", preferredBookingAt: "2026-06-25T12:00:00.000Z" }],
      message: undefined,
    });
  });

  it("rejects oversized user messages before dispatch", () => {
    expect(() =>
      parseChatIngressPayload(
        {
          message: "x".repeat(4001),
        },
        { requireMessage: true },
      ),
    ).toThrow(ChatRequestGuardrailError);
  });
});
