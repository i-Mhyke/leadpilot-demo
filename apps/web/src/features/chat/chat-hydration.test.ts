import { describe, expect, it } from "vitest";
import type { EveMessage } from "./use-flue-agent";
import { assistantMessageText, chatThreadAgentKey, messageHasFailedTool } from "./chat-utils";
import { dropHydrationSessionCursor } from "./chat-hydration-state";
import { dbMessagesToInitialEvents } from "./hydrate-chat-events";
import { removeDemoSessionFromList, type DemoSession } from "./hooks/use-demo-sessions";
import {
  dropReplayUnsafeCursor,
  isResumableSessionCursor,
  mergeSessionCursors,
  sessionCursorsEqual,
} from "./merge-session-cursor";

describe("chat-utils", () => {
  it("detects failed tool parts on assistant messages", () => {
    const message = {
      id: "assistant-1",
      role: "assistant",
      metadata: {},
      parts: [{ type: "dynamic-tool", toolName: "record_conversation_topic", state: "output-error", toolCallId: "1" }],
    } as unknown as EveMessage;

    expect(messageHasFailedTool(message)).toBe(true);
    expect(assistantMessageText(message)).toBe("");
  });
});

describe("hydrate-chat-events", () => {
  it("shouldMapVisitorAndAssistantMessagesToEveEvents", () => {
    const events = dbMessagesToInitialEvents([
      {
        id: "m1",
        conversationId: "c1",
        firmId: "f1",
        role: "visitor",
        content: "hello",
        eveTurnId: "turn-1:user",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "m2",
        conversationId: "c1",
        firmId: "f1",
        role: "assistant",
        content: "Hi from E&C Legal.",
        eveTurnId: "turn-1",
        createdAt: "2026-01-01T00:00:01.000Z",
      },
    ]);

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      type: "message.received",
      data: { message: "hello", turnId: "turn-1" },
    });
    expect(events[1]).toMatchObject({
      type: "message.completed",
      data: { message: "Hi from E&C Legal.", turnId: "turn-1", finishReason: "stop" },
    });
  });
});

describe("chat-hydration-state", () => {
  it("shouldDropHydratedCursorWithoutDroppingPersistedMessages", () => {
    const hydrated = {
      initialEvents: dbMessagesToInitialEvents([
        {
          id: "m1",
          conversationId: "c1",
          firmId: "f1",
          role: "visitor" as const,
          content: "hello",
          eveTurnId: "turn-1:user",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ]),
      sessionCursor: {
        sessionId: "eve-stale",
        continuationToken: "token-stale",
        streamIndex: 0,
      },
    };

    expect(dropHydrationSessionCursor(hydrated)).toEqual({
      initialEvents: hydrated.initialEvents,
      sessionCursor: undefined,
    });
  });
});

describe("merge-session-cursor", () => {
  it("shouldOnlyResumeCursorsThatHaveAContinuationTokenAndAdvancedStream", () => {
    expect(isResumableSessionCursor(undefined)).toBe(false);
    expect(isResumableSessionCursor({ streamIndex: 0 })).toBe(false);
    expect(isResumableSessionCursor({ sessionId: "eve-1", streamIndex: 4 })).toBe(false);
    expect(
      isResumableSessionCursor({
        sessionId: "eve-1",
        continuationToken: "tok-1",
        streamIndex: 0,
      }),
    ).toBe(false);
    expect(
      isResumableSessionCursor({
        sessionId: "eve-1",
        continuationToken: "tok-1",
        streamIndex: 4,
      }),
    ).toBe(true);
  });

  it("shouldPreferRemoteCursorWhenOpenConversationExists", () => {
    expect(
      mergeSessionCursors(
        { sessionId: "eve-1", continuationToken: "tok-a", streamIndex: 4 },
        { sessionId: "eve-1", continuationToken: "tok-b", streamIndex: 6 },
      ),
    ).toEqual({
      sessionId: "eve-1",
      continuationToken: "tok-b",
      streamIndex: 6,
    });
  });

  it("shouldKeepHigherLocalStreamIndexForSameRemoteSession", () => {
    expect(
      mergeSessionCursors(
        { sessionId: "eve-1", continuationToken: "tok-local", streamIndex: 9 },
        { sessionId: "eve-1", continuationToken: "tok-remote", streamIndex: 6 },
      ),
    ).toEqual({
      sessionId: "eve-1",
      continuationToken: "tok-remote",
      streamIndex: 9,
    });
  });

  it("shouldDropPoisonedLocalCursorWhenNoOpenConversation", () => {
    expect(
      mergeSessionCursors(
        { sessionId: "eve-dead", continuationToken: "tok-a", streamIndex: 2 },
        undefined,
        { remoteConversationActive: false },
      ),
    ).toBeUndefined();
  });

  it("shouldFallBackToRemoteCursorWhenLocalMissing", () => {
    expect(
      mergeSessionCursors(undefined, {
        sessionId: "eve-2",
        continuationToken: "tok-b",
        streamIndex: 5,
      }),
    ).toEqual({
      sessionId: "eve-2",
      continuationToken: "tok-b",
      streamIndex: 5,
    });
  });

  it("shouldKeepLocalContinuationWhenRemoteCursorWasResetAfterCompletion", () => {
    expect(
      mergeSessionCursors(
        { sessionId: "eve-1", continuationToken: "tok-local", streamIndex: 9 },
        { streamIndex: 0 },
        { remoteConversationActive: true },
      ),
    ).toEqual({
      sessionId: "eve-1",
      continuationToken: "tok-local",
      streamIndex: 9,
    });
  });

  it("shouldTreatEquivalentCursorsAsEqual", () => {
    expect(
      sessionCursorsEqual(
        { sessionId: "eve-1", continuationToken: "tok-a", streamIndex: 4 },
        { sessionId: "eve-1", continuationToken: "tok-a", streamIndex: 4 },
      ),
    ).toBe(true);
  });

  it("shouldDropZeroIndexCursorWhenPersistedEventsAlreadyHydrateMessages", () => {
    expect(
      dropReplayUnsafeCursor(
        { sessionId: "eve-legacy", continuationToken: "tok-legacy", streamIndex: 0 },
        2,
      ),
    ).toBeUndefined();
  });

  it("shouldDropLowIndexCursorWhenPersistedEventsCouldReplayIntoHydratedMessages", () => {
    expect(
      dropReplayUnsafeCursor(
        { sessionId: "eve-legacy", continuationToken: "tok-legacy", streamIndex: 1 },
        2,
      ),
    ).toBeUndefined();
  });

  it("shouldDropNonResumableCursorWhenPersistedEventsAlreadyHydrateMessages", () => {
    expect(
      dropReplayUnsafeCursor(
        { sessionId: "eve-legacy", streamIndex: 8 },
        2,
      ),
    ).toBeUndefined();
  });

  it("shouldKeepAdvancedCursorWhenPersistedEventsHydrateMessages", () => {
    expect(
      dropReplayUnsafeCursor(
        { sessionId: "eve-current", continuationToken: "tok-current", streamIndex: 8 },
        2,
      ),
    ).toEqual({ sessionId: "eve-current", continuationToken: "tok-current", streamIndex: 8 });
  });
});

describe("chatThreadAgentKey", () => {
  it("shouldNotChangeWhenOnlyTheHydratedEveCursorChanges", () => {
    expect(
      chatThreadAgentKey({
        sessionId: "browser-1",
        runtimeResetKey: 2,
        hydrationSessionId: "eve-a",
      }),
    ).toBe("browser-1:2");
    expect(
      chatThreadAgentKey({
        sessionId: "browser-1",
        runtimeResetKey: 2,
        hydrationSessionId: "eve-b",
      }),
    ).toBe("browser-1:2");
  });
});

describe("removeDemoSessionFromList", () => {
  const sessions: DemoSession[] = [
    {
      id: "session-a",
      firmSlug: "demo-law",
      customerName: "Active",
      matterLabel: "Active matter",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "session-b",
      firmSlug: "demo-law",
      customerName: "Second",
      matterLabel: "Second matter",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ];

  it("shouldRemoveInactiveSessionWithoutChangingActiveSession", () => {
    expect(removeDemoSessionFromList(sessions, "session-a", "session-b")).toEqual({
      sessions: [sessions[0]],
      activeSessionId: "session-a",
    });
  });

  it("shouldSelectAnotherSessionWhenDeletingActiveSession", () => {
    expect(removeDemoSessionFromList(sessions, "session-a", "session-a")).toEqual({
      sessions: [sessions[1]],
      activeSessionId: "session-b",
    });
  });
});
