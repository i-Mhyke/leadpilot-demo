const DEFAULT_QUERY_TIMEOUT_MS = 12_000;
const MAX_QUERY_TIMEOUT_MS = 60_000;

export function readFirmEmbeddingQueryTimeoutMs(
  env: NodeJS.ProcessEnv = process.env,
): number {
  return readEmbeddingQueryTimeoutMs(env.FIRM_EMBEDDING_QUERY_TIMEOUT_MS);
}

export function readLegalEmbeddingQueryTimeoutMs(
  env: NodeJS.ProcessEnv = process.env,
): number {
  return readEmbeddingQueryTimeoutMs(env.LEGAL_EMBEDDING_QUERY_TIMEOUT_MS);
}

function readEmbeddingQueryTimeoutMs(raw: string | undefined): number {
  if (!raw) return DEFAULT_QUERY_TIMEOUT_MS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > MAX_QUERY_TIMEOUT_MS) {
    throw new Error(
      `Embedding query timeout must be a positive integer up to ${MAX_QUERY_TIMEOUT_MS}.`,
    );
  }
  return parsed;
}

export function composeAbortSignals(
  callerSignal: AbortSignal | undefined,
  deadlineSignal: AbortSignal,
): AbortSignal {
  if (!callerSignal) return deadlineSignal;
  if (callerSignal.aborted) return callerSignal;
  if (deadlineSignal.aborted) return deadlineSignal;

  if ("any" in AbortSignal && typeof AbortSignal.any === "function") {
    return AbortSignal.any([callerSignal, deadlineSignal]);
  }

  const controller = new AbortController();
  const forwardAbort = (signal: AbortSignal) => {
    if (!controller.signal.aborted) controller.abort(signal.reason);
  };
  callerSignal.addEventListener("abort", () => forwardAbort(callerSignal), { once: true });
  deadlineSignal.addEventListener("abort", () => forwardAbort(deadlineSignal), { once: true });
  return controller.signal;
}

export function createQueryDeadlineSignal(
  timeoutMs: number,
  callerSignal?: AbortSignal,
): { signal: AbortSignal; cleanup: () => void; timedOut: () => boolean } {
  const deadlineController = new AbortController();
  let didTimeout = false;
  const timer = setTimeout(() => {
    didTimeout = true;
    deadlineController.abort(
      Object.assign(new Error("Embedding query deadline exceeded"), {
        name: "EmbeddingQueryDeadlineError",
      }),
    );
  }, timeoutMs);

  return {
    signal: composeAbortSignals(callerSignal, deadlineController.signal),
    cleanup: () => clearTimeout(timer),
    timedOut: () => didTimeout,
  };
}

export function remainingDeadlineMs(deadlineAtMs: number, nowMs = Date.now()): number {
  return Math.max(0, deadlineAtMs - nowMs);
}
