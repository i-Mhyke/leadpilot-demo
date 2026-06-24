import type { DemoSessionCursor } from "./hooks/use-demo-sessions";
import { isPersistableSessionCursor, isResumableSessionCursor, sessionCursorsEqual } from "./merge-session-cursor";

export type CursorPersistenceRequest = {
  firmSlug: string;
  browserSessionId: string;
  conversationId?: string;
  cursor: DemoSessionCursor;
};

export type CursorPersistenceResult = {
  conversationId?: string;
};

export function cursorPersistenceRequestsEqual(
  a: CursorPersistenceRequest | undefined,
  b: CursorPersistenceRequest | undefined,
) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    a.firmSlug === b.firmSlug &&
    a.browserSessionId === b.browserSessionId &&
    a.conversationId === b.conversationId &&
    sessionCursorsEqual(a.cursor, b.cursor)
  );
}

function isPersistableCursorRequest(request: CursorPersistenceRequest | undefined) {
  return Boolean(request && isPersistableSessionCursor(request.cursor));
}

export function createCursorPersistenceQueue(
  persist: (request: CursorPersistenceRequest) => Promise<CursorPersistenceResult | void>,
  onPersisted?: (
    result: CursorPersistenceResult | void,
    request: CursorPersistenceRequest,
  ) => void,
) {
  let latest: CursorPersistenceRequest | undefined;
  let lastPersisted: CursorPersistenceRequest | undefined;
  let inFlight: Promise<void> | undefined;
  let generation = 0;

  async function runPersist(request: CursorPersistenceRequest, requestGeneration: number) {
    try {
      const result = await persist(request);
      if (requestGeneration !== generation) return;
      lastPersisted = request;
      onPersisted?.(result, request);
    } finally {
      if (requestGeneration === generation) {
        inFlight = undefined;
        if (latest && !cursorPersistenceRequestsEqual(latest, lastPersisted)) {
          void flush();
        }
      }
    }
  }

  function stage(request: CursorPersistenceRequest) {
    if (!isPersistableCursorRequest(request)) return;
    latest = request;
  }

  async function flush(request?: CursorPersistenceRequest) {
    if (request) stage(request);
    if (inFlight) return inFlight;
    if (!latest || cursorPersistenceRequestsEqual(latest, lastPersisted)) {
      latest = undefined;
      return;
    }

    const requestToPersist = latest;
    const requestGeneration = generation;
    latest = undefined;
    inFlight = runPersist(requestToPersist, requestGeneration);
    return inFlight;
  }

  function reset() {
    latest = undefined;
    lastPersisted = undefined;
    generation += 1;
  }

  return {
    stage,
    flush,
    reset,
  };
}
