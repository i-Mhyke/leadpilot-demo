import type { FlueStreamEvent } from "./flue-session";

export type TurnRecoveryPolicy = {
  maxReconnectAttempts: number;
  retryDelayMs: number;
};

export const DEFAULT_TURN_RECOVERY_POLICY: TurnRecoveryPolicy = {
  maxReconnectAttempts: 3,
  retryDelayMs: 250,
};

export type TurnRecoveryResult =
  | {
      status: "terminal";
      boundary: "session.completed" | "session.failed" | "session.waiting";
      recoveredVisibleEvents: FlueStreamEvent[];
    }
  | { status: "exhausted" }
  | { status: "aborted" };

export function isTerminalBoundaryEvent(event: FlueStreamEvent) {
  return (
    event.type === "session.completed" ||
    event.type === "session.failed" ||
    event.type === "session.waiting"
  );
}

export function shouldDisableSendWhileReconciling(needsReconciliation: boolean | undefined) {
  return needsReconciliation === true;
}

export function streamEventIdentity(event: FlueStreamEvent, streamIndex: number) {
  const data =
    "data" in event && event.data && typeof event.data === "object"
      ? (event.data as { sequence?: number; turnId?: string })
      : undefined;
  if (data?.sequence !== undefined) {
    return `${event.type}:${data.sequence}`;
  }
  if (data?.turnId) {
    return `${event.type}:${data.turnId}:${streamIndex}`;
  }
  return `${event.type}:${streamIndex}`;
}

export function dedupeStreamEventsByIdentity<T extends { type: string }>(
  events: T[],
  identityFor: (event: T, index: number) => string | undefined,
): T[] {
  const seen = new Set<string>();
  const deduped: T[] = [];

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index]!;
    const identity = identityFor(event, index) ?? `${event.type}:${index}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    deduped.push(event);
  }

  return deduped;
}

export async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function mergeRecoveredAgentEvents(
  hydrationEvents: readonly FlueStreamEvent[],
  liveEvents: readonly FlueStreamEvent[],
  recoveredEvents: readonly FlueStreamEvent[],
): FlueStreamEvent[] {
  const combined = [...hydrationEvents, ...liveEvents, ...recoveredEvents];
  return dedupeStreamEventsByIdentity(combined, (event, index) =>
    streamEventIdentity(event, index),
  );
}
