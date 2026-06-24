import type { FlueStreamEvent } from "./flue-session";
import { describe, expect, it } from "vitest";
import { planStreamRecoveryUpdate } from "./chat-recovery-flow";

describe("planStreamRecoveryUpdate", () => {
  const hydrationEvents = [
    {
      type: "message.received",
      data: { message: "hello", sequence: 1, turnId: "turn-1" },
    },
  ] as FlueStreamEvent[];

  const liveEvents = [
    {
      type: "turn.started",
      data: { sequence: 2, turnId: "turn-1" },
    },
  ] as FlueStreamEvent[];

  it("seeds recovered assistant events and bumps runtime reset when reconciliation completes", () => {
    const recoveredVisibleEvents = [
      {
        type: "message.completed",
        data: {
          message: "Recovered answer",
          sequence: 3,
          turnId: "turn-1",
          finishReason: "stop",
          stepIndex: 0,
        },
      },
      {
        type: "session.waiting",
        data: { wait: "next-user-message" },
      },
    ] as unknown as FlueStreamEvent[];

    const plan = planStreamRecoveryUpdate({
      result: {
        status: "terminal",
        boundary: "session.waiting",
        recoveredVisibleEvents,
      },
      runtimeCursor: {
        sessionId: "eve-1",
        continuationToken: "token-1",
        streamIndex: 4,
      },
      hydrationEvents,
      liveEvents,
      previousRuntimeResetKey: 42,
      recoveryNonce: 99,
    });

    expect(plan?.seedEvents?.some((event) => event.type === "message.completed")).toBe(true);
    expect(plan?.sessionUpdate.runtimeResetKey).toBe(99);
    expect(plan?.sessionUpdate.lastError).toBeUndefined();
  });

  it("does not remount when reconciliation returns no new visible events", () => {
    const plan = planStreamRecoveryUpdate({
      result: {
        status: "terminal",
        boundary: "session.waiting",
        recoveredVisibleEvents: [],
      },
      runtimeCursor: {
        sessionId: "eve-1",
        continuationToken: "token-1",
        streamIndex: 4,
      },
      hydrationEvents,
      liveEvents,
      previousRuntimeResetKey: 42,
      recoveryNonce: 99,
    });

    expect(plan?.seedEvents).toBeUndefined();
    expect(plan?.sessionUpdate.runtimeResetKey).toBe(42);
  });
});
