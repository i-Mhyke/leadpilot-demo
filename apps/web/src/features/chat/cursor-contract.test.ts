import { describe, expect, it } from "vitest";
import { parsePersistChatSessionCursorRequest } from "./validators";
import { isPersistableSessionCursor } from "./merge-session-cursor";

describe("cursor persistence contract alignment", () => {
  const reconciliationCursor = {
    sessionId: "eve-1",
    streamIndex: 0,
    needsReconciliation: true,
  };

  it("treats first-stream reconciliation cursors as persistable and valid", () => {
    expect(isPersistableSessionCursor(reconciliationCursor)).toBe(true);
    expect(
      parsePersistChatSessionCursorRequest({
        firmSlug: "demo-law",
        browserSessionId: "browser-1",
        sessionCursor: reconciliationCursor,
      }),
    ).toMatchObject({
      sessionCursor: reconciliationCursor,
    });
  });

  it("rejects non-reconciliation cursors without continuation tokens", () => {
    expect(
      isPersistableSessionCursor({
        sessionId: "eve-1",
        streamIndex: 2,
      }),
    ).toBe(false);

    expect(() =>
      parsePersistChatSessionCursorRequest({
        firmSlug: "demo-law",
        browserSessionId: "browser-1",
        sessionCursor: {
          sessionId: "eve-1",
          streamIndex: 2,
        },
      }),
    ).toThrow();
  });
});
