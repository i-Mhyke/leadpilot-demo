import { describe, expect, it } from "vitest";
import { chatErrorMessageForVisitor, shouldPreserveSessionCursorOnError, shouldShowChatPerfOverlay } from "./chat-utils";

describe("chatErrorMessageForVisitor", () => {
  it("does not expose provider request ids or raw server_error payloads", () => {
    const message = chatErrorMessageForVisitor(
      '{"type":"error","sequence_number":2,"error":{"type":"server_error","code":"server_error","message":"include request ID req_519e6fa570864f649a59d9dcef2963f4"}}',
    );

    expect(message).toMatch(/temporary/i);
    expect(message).not.toContain("req_519e6fa570864f649a59d9dcef2963f4");
    expect(message).not.toContain("server_error");
  });

  it("uses a connection-specific message for network failures", () => {
    expect(chatErrorMessageForVisitor("Failed to fetch")).toMatch(/reach the assistant/i);
  });

  it("preserves session cursor for timeout recovery copy", () => {
    expect(shouldPreserveSessionCursorOnError("Turn deadline exceeded")).toBe(true);
    expect(shouldPreserveSessionCursorOnError("Failed to fetch")).toBe(false);
  });
});

describe("shouldShowChatPerfOverlay", () => {
  it("stays off in development unless explicitly enabled", () => {
    expect(shouldShowChatPerfOverlay({ DEV: true })).toBe(false);
  });

  it("can be explicitly enabled for local profiling", () => {
    expect(
      shouldShowChatPerfOverlay({
        DEV: true,
        VITE_CHAT_PERF_OVERLAY: "true",
      }),
    ).toBe(true);
  });
});
