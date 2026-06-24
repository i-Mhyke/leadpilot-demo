import type { FlueStreamEvent } from "./flue-session";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LEADPILOT_CLIENT_CONTEXT_HEADER } from "@/lib/leadpilot-client-context";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  advanceSession,
  createHydratedTurnReplayFilter,
  createLeadPilotEveSession,
  createLeadPilotEveSessionOptions,
  isReasoningStreamEvent,
  reconcileLeadPilotEveSession,
} from "./eve-session";

describe("createLeadPilotEveSessionOptions", () => {
  it("does not import the Node-oriented eve/client entrypoint at runtime", () => {
    const source = readFileSync(resolve(__dirname, "eve-session.ts"), "utf8");

    expect(source).not.toMatch(/import\s+\{[^}]*\bClient\b[^}]*\}\s+from\s+["']eve\/client["']/);
  });

  it("preserves completed Eve sessions so follow-up messages continue the chat", () => {
    const options = createLeadPilotEveSessionOptions({
      getClientContext: () => ({
        browserSessionId: "browser-1",
        firmSlug: "demo-law",
      }),
      host: "",
    });

    expect(options.preserveCompletedSessions).toBe(true);
  });

  it("resolves the latest client context for each Eve request", () => {
    let localConversationId: string | undefined;
    const options = createLeadPilotEveSessionOptions({
      getClientContext: () => ({
        browserSessionId: "browser-1",
        firmSlug: "demo-law",
        ...(localConversationId ? { localConversationId } : {}),
      }),
      host: "",
    });
    const resolveHeaders = options.headers as () => Readonly<Record<string, string>>;

    expect(JSON.parse(resolveHeaders()[LEADPILOT_CLIENT_CONTEXT_HEADER]!)).toEqual({
      browserSessionId: "browser-1",
      firmSlug: "demo-law",
    });

    localConversationId = "conversation-1";

    expect(JSON.parse(resolveHeaders()[LEADPILOT_CLIENT_CONTEXT_HEADER]!)).toEqual({
      browserSessionId: "browser-1",
      firmSlug: "demo-law",
      localConversationId: "conversation-1",
    });
  });
});

describe("createHydratedTurnReplayFilter", () => {
  it("filters replayed hydrated turn events until a new turn starts", () => {
    const filter = createHydratedTurnReplayFilter(new Set(["turn-1"]));

    expect(
      filter({
        type: "message.completed",
        data: {
          finishReason: "stop",
          message: "old answer",
          sequence: 1,
          stepIndex: 0,
          turnId: "turn-1",
        },
      }),
    ).toBe(false);
    expect(filter({ type: "session.completed" })).toBe(false);
    expect(
      filter({
        type: "message.received",
        data: {
          message: "new question",
          sequence: 2,
          turnId: "turn-2",
        },
      }),
    ).toBe(true);
    expect(filter({ type: "session.completed" })).toBe(true);
  });

  it("allows all stream events when no hydrated turn ids are known", () => {
    const filter = createHydratedTurnReplayFilter(new Set());

    expect(
      filter({
        type: "message.completed",
        data: {
          finishReason: "stop",
          message: "answer",
          sequence: 1,
          stepIndex: 0,
          turnId: "turn-1",
        },
      }),
    ).toBe(true);
    expect(filter({ type: "session.completed" })).toBe(true);
  });
});

describe("advanceSession", () => {
  it("preserves session id and stream index when no terminal boundary is observed", () => {
    const next = advanceSession({
      continuationToken: "token-1",
      events: [
        {
          type: "message.completed",
          data: {
            turnId: "turn-1",
            finishReason: "stop",
            message: "answer",
            sequence: 1,
            stepIndex: 0,
          },
        } as FlueStreamEvent,
      ],
      visibleEvents: [],
      previousState: { sessionId: "sess-1", streamIndex: 4, continuationToken: "token-1" },
      sessionId: "sess-1",
      startIndex: 4,
    });

    expect(next).toEqual({
      continuationToken: "token-1",
      sessionId: "sess-1",
      streamIndex: 5,
      needsReconciliation: true,
    });
  });

  it("clears reconciliation when session.waiting is observed", () => {
    const next = advanceSession({
      continuationToken: "token-1",
      events: [
        {
          type: "session.waiting",
          data: { wait: "next-user-message" },
        } as unknown as FlueStreamEvent,
      ],
      visibleEvents: [
        {
          type: "session.waiting",
          data: { wait: "next-user-message" },
        } as unknown as FlueStreamEvent,
      ],
      previousState: { sessionId: "sess-1", streamIndex: 2 },
      sessionId: "sess-1",
      startIndex: 2,
    });

    expect(next.needsReconciliation).toBe(false);
    expect(next.streamIndex).toBe(3);
  });
});

describe("isReasoningStreamEvent", () => {
  it("filters reasoning stream events", () => {
    expect(
      isReasoningStreamEvent({
        type: "reasoning.delta",
        data: { turnId: "turn-1", sequence: 1 },
      } as unknown as FlueStreamEvent),
    ).toBe(true);
    expect(
      isReasoningStreamEvent({
        type: "message.completed",
        data: {
          turnId: "turn-1",
          finishReason: "stop",
          message: "answer",
          sequence: 1,
          stepIndex: 0,
        },
      } as FlueStreamEvent),
    ).toBe(false);
  });
});

describe("reconcilePendingTurn", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns recovered visible assistant events after timeout reconciliation", async () => {
    const streamBody = [
      JSON.stringify({
        type: "message.completed",
        data: {
          turnId: "turn-1",
          finishReason: "stop",
          message: "Recovered answer",
          sequence: 3,
          stepIndex: 0,
        },
      }),
      JSON.stringify({ type: "session.waiting", data: { wait: "next-user-message" } }),
    ].join("\n");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(streamBody));
            controller.close();
          },
        }),
      }),
    );

    const session = createLeadPilotEveSession({
      getClientContext: () => ({
        browserSessionId: "browser-1",
        firmSlug: "demo-law",
      }),
      host: "http://agent.test",
      initialSession: {
        sessionId: "sess-1",
        streamIndex: 2,
        needsReconciliation: true,
      },
    });

    const result = await reconcileLeadPilotEveSession(session);
    expect(result).toMatchObject({
      status: "terminal",
      boundary: "session.waiting",
    });
    if (result.status !== "terminal") {
      throw new Error("expected terminal reconciliation");
    }
    expect(result.recoveredVisibleEvents.some((event) => event.type === "message.completed")).toBe(
      true,
    );
  });
});
