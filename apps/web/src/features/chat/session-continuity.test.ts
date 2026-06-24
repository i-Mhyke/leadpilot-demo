import { describe, expect, it } from "vitest";
import { mergeSessionCursors } from "./merge-session-cursor";

describe("session continuity", () => {
  it("reuses the same Eve session id across local and remote cursors", () => {
    const merged = mergeSessionCursors(
      { sessionId: "sess-1", continuationToken: "token-a", streamIndex: 3 },
      { sessionId: "sess-1", continuationToken: "token-b", streamIndex: 5 },
    );

    expect(merged?.sessionId).toBe("sess-1");
    expect(merged?.streamIndex).toBe(5);
    expect(merged?.continuationToken).toBe("token-b");
  });

  it("never combines continuation metadata from different sessions", () => {
    const merged = mergeSessionCursors(
      { sessionId: "sess-1", continuationToken: "token-a", streamIndex: 8 },
      { sessionId: "sess-2", continuationToken: "token-b", streamIndex: 2 },
    );

    expect(merged?.sessionId).toBe("sess-2");
    expect(merged?.continuationToken).toBe("token-b");
    expect(merged?.streamIndex).toBe(2);
  });

  it("drops poisoned local cursor when remote conversation is inactive", () => {
    const merged = mergeSessionCursors(
      { sessionId: "sess-1", continuationToken: "token-a", streamIndex: 4 },
      undefined,
      { remoteConversationActive: false },
    );

    expect(merged).toBeUndefined();
  });

  it("preserves reconciliation flags when merging cursors", () => {
    const merged = mergeSessionCursors(
      { sessionId: "sess-1", continuationToken: "token-a", streamIndex: 4, needsReconciliation: true },
      { sessionId: "sess-1", continuationToken: "token-b", streamIndex: 6 },
    );

    expect(merged?.needsReconciliation).toBe(true);
    expect(merged?.streamIndex).toBe(6);
  });
});
