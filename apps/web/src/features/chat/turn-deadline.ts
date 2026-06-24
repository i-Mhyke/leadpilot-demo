export const DEFAULT_TURN_TIMEOUT_MS = 45_000;
const MAX_TURN_TIMEOUT_MS = 120_000;

export type TurnTerminalState =
  | "completed"
  | "failed"
  | "stopped-by-user"
  | "timed-out-awaiting-reconciliation";

export function readTurnTimeoutMs(
  env: Record<string, string | boolean | undefined> = import.meta.env,
): number {
  const raw = env.VITE_LEADPILOT_TURN_TIMEOUT_MS;
  if (!raw || typeof raw !== "string") return DEFAULT_TURN_TIMEOUT_MS;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > MAX_TURN_TIMEOUT_MS) {
    throw new Error(
      `VITE_LEADPILOT_TURN_TIMEOUT_MS must be a positive integer up to ${MAX_TURN_TIMEOUT_MS}.`,
    );
  }

  return parsed;
}

export function isTurnGuardrailsEnabled(
  env: Record<string, string | boolean | undefined> = import.meta.env,
): boolean {
  return env.VITE_LEADPILOT_TURN_GUARDRAILS_ENABLED === "true";
}

export function composeAbortSignals(
  ...signals: Array<AbortSignal | undefined>
): AbortSignal | undefined {
  const active = signals.filter((signal): signal is AbortSignal => Boolean(signal));
  if (active.length === 0) return undefined;
  if (active.length === 1) return active[0];

  if ("any" in AbortSignal && typeof AbortSignal.any === "function") {
    return AbortSignal.any(active);
  }

  const controller = new AbortController();
  for (const signal of active) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
    signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}

export function createTurnDeadlineController(timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(
      Object.assign(new DOMException("Turn deadline exceeded", "TimeoutError"), {
        leadpilotTurnDeadline: true,
      }),
    );
  }, timeoutMs);

  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timer),
    isDeadlineAbort(error: unknown) {
      return error instanceof DOMException && error.name === "TimeoutError" && "leadpilotTurnDeadline" in error;
    },
  };
}

export function classifyTurnAbort(
  signal: AbortSignal | undefined,
  error?: unknown,
): TurnTerminalState | undefined {
  if (!signal?.aborted && !error) return undefined;

  const reason = signal?.reason ?? error;
  if (reason instanceof DOMException && reason.name === "TimeoutError" && "leadpilotTurnDeadline" in reason) {
    return "timed-out-awaiting-reconciliation";
  }
  if (signal?.aborted) {
    return "stopped-by-user";
  }
  return "failed";
}
