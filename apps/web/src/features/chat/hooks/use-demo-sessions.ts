import { useCallback, useEffect, useMemo, useState } from "react";
import { CHAT_COPY } from "../copy";

export type DemoSessionCursor = {
  continuationToken?: string;
  sessionId?: string;
  streamIndex: number;
  needsReconciliation?: boolean;
};

export type DemoSession = {
  id: string;
  conversationId?: string;
  firmSlug: string;
  customerName: string;
  matterLabel: string;
  sessionCursor?: DemoSessionCursor;
  lastMessagePreview?: string;
  lastError?: string;
  runtimeResetKey?: number;
  turnRecoveryExhausted?: boolean;
  updatedAt: string;
};

const SESSIONS_KEY = "leadpilot.demo.sessions";
const ACTIVE_KEY = "leadpilot.demo.activeSessionId";
const LEGACY_SEED_SIGNATURES = new Set([
  "Amara Okonkwo|SAFE notes, seed round",
  "Theo Whitfield|NDPR readiness review",
  "Priya Mehta|Remittance API licensing",
]);

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function persistFirmSessions(firmSlug: string, firmSessions: DemoSession[]) {
  const stored = readStorage<DemoSession[]>(SESSIONS_KEY, []);
  const others = stored.filter((s) => s.firmSlug !== firmSlug);
  const next = [...others, ...firmSessions];
  writeStorage(SESSIONS_KEY, next);
}

function readActiveSessionMap() {
  const raw = readStorage<Record<string, string> | string>(ACTIVE_KEY, {});
  if (typeof raw === "string") {
    return {};
  }
  return raw;
}

function writeActiveSessionId(firmSlug: string, sessionId: string) {
  const map = readActiveSessionMap();
  writeStorage(ACTIVE_KEY, { ...map, [firmSlug]: sessionId });
}

export function clearStoredSessionsForFirm(firmSlug: string) {
  if (typeof window === "undefined") return;
  const stored = readStorage<DemoSession[]>(SESSIONS_KEY, []);
  writeStorage(
    SESSIONS_KEY,
    stored.filter((session) => session.firmSlug !== firmSlug),
  );
  const activeMap = readActiveSessionMap();
  if (!(firmSlug in activeMap)) return;
  const { [firmSlug]: _removed, ...rest } = activeMap;
  writeStorage(ACTIVE_KEY, rest);
}

function seedSessions(firmSlug: string): DemoSession[] {
  const now = new Date().toISOString();
  return [
    {
      id: crypto.randomUUID(),
      firmSlug,
      customerName: CHAT_COPY.newSessionCustomer,
      matterLabel: CHAT_COPY.newSessionMatter,
      updatedAt: now,
    },
  ];
}

function isLegacySeedSession(session: DemoSession) {
  return LEGACY_SEED_SIGNATURES.has(`${session.customerName}|${session.matterLabel}`);
}

function normalizeFirmSessions(firmSlug: string, firmSessions: DemoSession[]) {
  const filtered = firmSessions.filter((session) => !isLegacySeedSession(session));
  if (filtered.length > 0) {
    return filtered;
  }
  return seedSessions(firmSlug);
}

export function removeDemoSessionFromList(
  sessions: DemoSession[],
  activeSessionId: string | null,
  sessionId: string,
): { sessions: DemoSession[]; activeSessionId: string | null } {
  const nextSessions = sessions.filter((session) => session.id !== sessionId);
  if (activeSessionId !== sessionId) {
    return {
      sessions: nextSessions,
      activeSessionId,
    };
  }

  return {
    sessions: nextSessions,
    activeSessionId: nextSessions[0]?.id ?? null,
  };
}

export function useDemoSessions(firmSlug: string) {
  const [sessions, setSessions] = useState<DemoSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readStorage<DemoSession[]>(SESSIONS_KEY, []);
    const forFirm = stored.filter((s) => s.firmSlug === firmSlug);
    const nextSessions = normalizeFirmSessions(firmSlug, forFirm);
    const activeMap = readActiveSessionMap();
    const storedActive = activeMap[firmSlug] ?? null;
    const active =
      storedActive && nextSessions.some((s) => s.id === storedActive)
        ? storedActive
        : nextSessions[0]?.id ?? null;

    setSessions(nextSessions);
    setActiveSessionId(active);
    setHydrated(true);

    if (forFirm.length === 0 || nextSessions.length !== forFirm.length) {
      persistFirmSessions(firmSlug, nextSessions);
    }
    if (active) writeActiveSessionId(firmSlug, active);
  }, [firmSlug]);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  );

  const selectSession = useCallback(
    (sessionId: string) => {
      setActiveSessionId(sessionId);
      writeActiveSessionId(firmSlug, sessionId);
    },
    [firmSlug],
  );

  const createSession = useCallback(() => {
    const session: DemoSession = {
      id: crypto.randomUUID(),
      firmSlug,
      customerName: CHAT_COPY.newSessionCustomer,
      matterLabel: CHAT_COPY.newSessionMatter,
      updatedAt: new Date().toISOString(),
    };
    setSessions((prev) => {
      const next = [session, ...prev];
      persistFirmSessions(firmSlug, next);
      return next;
    });
    selectSession(session.id);
    return session;
  }, [firmSlug, selectSession]);

  const updateSession = useCallback(
    (sessionId: string, patch: Partial<DemoSession>) => {
      setSessions((prev) => {
        const next = prev.map((s) =>
          s.id === sessionId ? { ...s, ...patch, updatedAt: patch.updatedAt ?? new Date().toISOString() } : s,
        );
        persistFirmSessions(firmSlug, next);
        return next;
      });
    },
    [firmSlug],
  );

  const deleteSession = useCallback(
    (sessionId: string) => {
      setSessions((prev) => {
        const result = removeDemoSessionFromList(prev, activeSessionId, sessionId);
        const next =
          result.sessions.length > 0
            ? result
            : {
                sessions: [
                  {
                    id: crypto.randomUUID(),
                    firmSlug,
                    customerName: CHAT_COPY.newSessionCustomer,
                    matterLabel: CHAT_COPY.newSessionMatter,
                    updatedAt: new Date().toISOString(),
                  },
                ],
                activeSessionId: null,
              };
        const nextActiveSessionId = next.activeSessionId ?? next.sessions[0]?.id ?? null;

        persistFirmSessions(firmSlug, next.sessions);
        if (nextActiveSessionId) {
          setActiveSessionId(nextActiveSessionId);
          writeActiveSessionId(firmSlug, nextActiveSessionId);
        }

        return next.sessions;
      });
    },
    [activeSessionId, firmSlug],
  );

  return {
    sessions,
    activeSession,
    activeSessionId,
    hydrated,
    selectSession,
    createSession,
    deleteSession,
    updateSession,
  };
}
