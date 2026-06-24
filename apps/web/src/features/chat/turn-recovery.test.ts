import type { FlueStreamEvent } from "./flue-session";
import { describe, expect, it } from "vitest";
import {
  dedupeStreamEventsByIdentity,
  isTerminalBoundaryEvent,
  mergeRecoveredAgentEvents,
  shouldDisableSendWhileReconciling,
  streamEventIdentity,
} from "./turn-recovery";

describe("turn-recovery", () => {
  it("detects terminal boundaries", () => {
    expect(
      isTerminalBoundaryEvent({
        type: "session.waiting",
        data: { wait: "next-user-message" },
      } as unknown as FlueStreamEvent),
    ).toBe(true);
    expect(
      isTerminalBoundaryEvent({
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

  it("disables send while reconciliation is pending", () => {
    expect(shouldDisableSendWhileReconciling(true)).toBe(true);
    expect(shouldDisableSendWhileReconciling(false)).toBe(false);
  });

  it("dedupes replayed events by durable identity", () => {
    const events = [
      { type: "message.completed", sequence: 1 },
      { type: "message.completed", sequence: 1 },
      { type: "message.completed", sequence: 2 },
    ];

    const deduped = dedupeStreamEventsByIdentity(events, (event) => `${event.type}:${event.sequence}`);
    expect(deduped).toHaveLength(2);
  });

  it("builds stable stream event identities from sequence numbers", () => {
    expect(
      streamEventIdentity(
        {
          type: "message.completed",
          data: { sequence: 12, turnId: "turn-1" },
        } as never,
        12,
      ),
    ).toBe("message.completed:12");
  });

  it("merges recovered stream events without duplicating live events", () => {
    const hydration = [
      {
        type: "message.received",
        data: { message: "hello", sequence: 1, turnId: "turn-1" },
      },
    ] as FlueStreamEvent[];
    const live = [
      {
        type: "message.completed",
        data: { message: "partial", sequence: 2, turnId: "turn-1", finishReason: "stop", stepIndex: 0 },
      },
    ] as FlueStreamEvent[];
    const recovered = [
      {
        type: "message.completed",
        data: { message: "partial", sequence: 2, turnId: "turn-1", finishReason: "stop", stepIndex: 0 },
      },
      {
        type: "session.waiting",
        data: { wait: "next-user-message" },
      },
    ] as unknown as FlueStreamEvent[];

    const merged = mergeRecoveredAgentEvents(hydration, live, recovered);
    expect(merged).toHaveLength(3);
    expect(merged.at(-1)?.type).toBe("session.waiting");
  });
});
