import { describe, expect, it } from "vitest";
import { ChatRequestError, parsePersistChatSessionCursorRequest } from "./validators";

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
