import { describe, expect, it } from "vitest";
import {
  ChatRequestError,
  parseBookingSelectionRequest,
  parsePersistChatSessionCursorRequest,
} from "./validators";

describe("parsePersistChatSessionCursorRequest", () => {
  it("accepts resumable Eve session cursors", () => {
    expect(
      parsePersistChatSessionCursorRequest({
        browserSessionId: "browser-1",
        firmSlug: "demo-law",
        sessionCursor: {
          continuationToken: "token-1",
          sessionId: "eve-1",
          streamIndex: 6,
        },
      }),
    ).toMatchObject({
      browserSessionId: "browser-1",
      firmSlug: "demo-law",
      sessionCursor: {
        continuationToken: "token-1",
        sessionId: "eve-1",
        streamIndex: 6,
      },
    });
  });

  it("rejects terminal reset cursors that would clear continuation state", () => {
    expect(() =>
      parsePersistChatSessionCursorRequest({
        browserSessionId: "browser-1",
        firmSlug: "demo-law",
        sessionCursor: {
          streamIndex: 0,
        },
      }),
    ).toThrow(ChatRequestError);
  });

  it("accepts reconciliation cursors without a continuation token", () => {
    expect(
      parsePersistChatSessionCursorRequest({
        browserSessionId: "browser-1",
        firmSlug: "demo-law",
        sessionCursor: {
          sessionId: "eve-1",
          streamIndex: 0,
          needsReconciliation: true,
        },
      }),
    ).toMatchObject({
      sessionCursor: {
        sessionId: "eve-1",
        streamIndex: 0,
        needsReconciliation: true,
      },
    });
  });
});

describe("parseBookingSelectionRequest", () => {
  it("accepts structured booking datetime selections", () => {
    expect(
      parseBookingSelectionRequest({
        browserSessionId: "browser-1",
        firmSlug: "demo-law",
        preferredBookingAt: "2026-06-24T14:30:00.000Z",
        preferredBookingLabel: "Wednesday, June 24, 2026 at 2:30 PM",
        sessionId: "sess-1",
      }),
    ).toEqual({
      browserSessionId: "browser-1",
      firmSlug: "demo-law",
      preferredBookingAt: "2026-06-24T14:30:00.000Z",
      preferredBookingLabel: "Wednesday, June 24, 2026 at 2:30 PM",
      sessionId: "sess-1",
    });
  });

  it("rejects missing booking datetimes", () => {
    expect(() =>
      parseBookingSelectionRequest({
        browserSessionId: "browser-1",
        firmSlug: "demo-law",
        sessionId: "sess-1",
      }),
    ).toThrow(ChatRequestError);
  });
});
