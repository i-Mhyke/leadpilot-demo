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
  if (typeof window !== "undefined") {
    console.log("[persistFirmSessions]", firmSlug, "count:", firmSessions.length, "total:", next.length);
  }
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

function seedSessions(firmSlug: string): DemoSession[] {
  const now = new Date().toISOString();
  return [
    {
      id: crypto.randomUUID(),
      firmSlug,
      customerName: "Amara Okonkwo",
      matterLabel: "SAFE notes, seed round",
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      firmSlug,
      customerName: "Theo Whitfield",
      matterLabel: "NDPR readiness review",
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      firmSlug,
      customerName: "Priya Mehta",
      matterLabel: "Remittance API licensing",
      updatedAt: now,
    },
  ];
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
    const nextSessions = forFirm.length > 0 ? forFirm : seedSessions(firmSlug);
    const activeMap = readActiveSessionMap();
    const storedActive = activeMap[firmSlug] ?? null;
    const active =
      storedActive && nextSessions.some((s) => s.id === storedActive)
        ? storedActive
        : nextSessions[0]?.id ?? null;

    console.log("[useDemoSessions] mount:", firmSlug,
      "stored:", stored.length, "forFirm:", forFirm.length,
      "next:", nextSessions.length, "active:", active,
      "found:", forFirm.length > 0 ? "from LS" : "seeded");

    setSessions(nextSessions);
    setActiveSessionId(active);
    setHydrated(true);

    if (forFirm.length === 0) {
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
