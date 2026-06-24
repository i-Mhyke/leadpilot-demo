import type { ChatSessionCursor } from "@leadpilot/shared";
import type { DemoSessionCursor } from "./hooks/use-demo-sessions";

export type ResumableSessionCursor = (DemoSessionCursor | ChatSessionCursor) & {
  continuationToken: string;
  sessionId: string;
  streamIndex: number;
};

export function sessionCursorsEqual(
  a?: DemoSessionCursor | ChatSessionCursor,
  b?: DemoSessionCursor | ChatSessionCursor,
) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    a.sessionId === b.sessionId &&
    a.continuationToken === b.continuationToken &&
    (a.streamIndex ?? 0) === (b.streamIndex ?? 0) &&
    Boolean(a.needsReconciliation) === Boolean(b.needsReconciliation)
  );
}

export function isResumableSessionCursor(
  cursor?: DemoSessionCursor | ChatSessionCursor,
): cursor is ResumableSessionCursor {
  return Boolean(cursor?.sessionId && cursor.continuationToken && cursor.streamIndex > 0);
}

export function isPersistableSessionCursor(
  cursor?: DemoSessionCursor | ChatSessionCursor,
): cursor is DemoSessionCursor & { sessionId: string } {
  if (!cursor?.sessionId) return false;
  if (cursor.needsReconciliation) {
    return cursor.streamIndex >= 0;
  }
  return isResumableSessionCursor(cursor);
}

export function mergeSessionCursors(
  local?: DemoSessionCursor,
  remote?: ChatSessionCursor,
  options?: { remoteConversationActive?: boolean },
): DemoSessionCursor | undefined {
  if (isResumableSessionCursor(remote)) {
    const sameSession = local?.sessionId === remote.sessionId;
    const localStreamIndex =
      sameSession && isResumableSessionCursor(local) ? local.streamIndex : undefined;
    return {
      sessionId: remote.sessionId,
      continuationToken: remote.continuationToken,
      streamIndex: Math.max(localStreamIndex ?? 0, remote.streamIndex),
      needsReconciliation: local?.needsReconciliation || remote.needsReconciliation,
    };
  }

  // A failed or missing open conversation means the local Eve session is poisoned.
  if (options?.remoteConversationActive === false && local?.sessionId) {
    return undefined;
  }

  if (isResumableSessionCursor(local)) {
    return local;
  }

  if (local?.sessionId && local.needsReconciliation) {
    return local;
  }

  return undefined;
}

export function dropReplayUnsafeCursor(
  cursor: DemoSessionCursor | undefined,
  initialEventCount: number,
): DemoSessionCursor | undefined {
  if (!isResumableSessionCursor(cursor)) {
    return undefined;
  }
  if (initialEventCount > 0 && cursor.streamIndex <= initialEventCount) {
    return undefined;
  }
  return cursor;
}
