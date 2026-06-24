import type { FlueStreamEvent } from "./flue-session";
import type { DemoSessionCursor } from "./hooks/use-demo-sessions";
import { mergeRecoveredAgentEvents, type TurnRecoveryResult } from "./turn-recovery";

export function planStreamRecoveryUpdate({
  result,
  runtimeCursor,
  hydrationEvents,
  liveEvents,
  previousRuntimeResetKey,
  recoveryNonce,
}: {
  result: Extract<TurnRecoveryResult, { status: "terminal" }>;
  runtimeCursor?: DemoSessionCursor;
  hydrationEvents: readonly FlueStreamEvent[];
  liveEvents: readonly FlueStreamEvent[];
  previousRuntimeResetKey?: number;
  recoveryNonce: number;
}) {
  if (!runtimeCursor || runtimeCursor.needsReconciliation) {
    return null;
  }

  const seedEvents =
    result.recoveredVisibleEvents.length > 0
      ? mergeRecoveredAgentEvents(hydrationEvents, liveEvents, result.recoveredVisibleEvents)
      : undefined;

  return {
    seedEvents,
    sessionUpdate: {
      sessionCursor: runtimeCursor,
      lastError: undefined,
      turnRecoveryExhausted: false as const,
      runtimeResetKey: seedEvents ? recoveryNonce : previousRuntimeResetKey,
    },
  };
}
