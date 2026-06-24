import { afterEach, describe, expect, it, vi } from "vitest";
import {
  classifyTurnAbort,
  composeAbortSignals,
  createTurnDeadlineController,
  readTurnTimeoutMs,
} from "./turn-deadline";

describe("turn-deadline", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("defaults to 45 seconds", () => {
    expect(readTurnTimeoutMs({})).toBe(45_000);
  });

  it("fires once and is distinguishable from manual stop", async () => {
    vi.useFakeTimers();
    const deadline = createTurnDeadlineController(45_000);
    const manual = new AbortController();
    const composed = composeAbortSignals(manual.signal, deadline.signal)!;

    const rejection = expect(async () => {
      await new Promise((_, reject) => {
        composed.addEventListener("abort", () => reject(composed.reason));
      });
    }).rejects.toMatchObject({ name: "TimeoutError" });

    await vi.advanceTimersByTimeAsync(45_000);
    await rejection;
    expect(classifyTurnAbort(composed, composed.reason)).toBe("timed-out-awaiting-reconciliation");

    manual.abort(new Error("stopped"));
    expect(classifyTurnAbort(manual.signal, manual.signal.reason)).toBe("stopped-by-user");
    deadline.cleanup();
  });
});
