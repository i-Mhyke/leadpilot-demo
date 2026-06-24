import { useCallback } from "react";
import { ArrowSquareOut, Plus, TrashSimple } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { formatFirmSlug } from "@/lib/format-firm-slug";
import { cn } from "@/lib/utils";
import { CHAT_MOTION, chatEnterClass, chatInitials, formatChatRelativeTime } from "../chat-utils";
import { CHAT_COPY } from "../copy";
import type { DemoSession } from "../hooks/use-demo-sessions";
import { ChatThread } from "./chat-thread";

function SessionSidebar({
  firmSlug,
  sessions,
  activeSessionId,
  firmName,
  onSelect,
  onCreate,
  onDelete,
}: {
  firmSlug: string;
  sessions: DemoSession[];
  activeSessionId: string | null;
  firmName: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <aside className="border-border/60 flex h-full min-h-0 w-full flex-col border-b md:w-64 md:shrink-0 md:border-r md:border-b-0">
      <div className="border-border/60 border-b px-4 py-5">
        <span className="bg-accent/80 text-accent-foreground inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-medium tracking-[0.14em] uppercase">
          Client chat
        </span>
        <h1 className="text-foreground mt-3 text-sm font-semibold tracking-tight">{CHAT_COPY.shellTitle}</h1>
        <p className="text-muted-foreground mt-1 font-mono text-[11px]">{firmSlug}</p>
        <p className="text-muted-foreground mt-2 text-xs">{CHAT_COPY.shellSubtitle(firmName)}</p>
      </div>

      <div className="border-border/60 flex items-center justify-between gap-2 border-b px-4 py-3">
        <p className="text-foreground text-sm font-semibold tracking-tight">{CHAT_COPY.sidebarTitle}</p>
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          className={cn("rounded-full", CHAT_MOTION, "active:scale-[0.98]")}
          onClick={onCreate}
          aria-label="New conversation"
        >
          <Plus className="size-4" weight="bold" />
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <nav className="flex flex-col gap-1 p-3" aria-label="Conversations">
          {sessions.map((session, index) => {
            const isActive = session.id === activeSessionId;
            return (
              <div
                key={session.id}
                className={cn(
                  "group flex w-full min-w-0 items-start gap-2.5 rounded-lg px-3 py-2.5 text-left",
                  CHAT_MOTION,
                  chatEnterClass(index + 1),
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                <div
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tracking-tight",
                    isActive ? "bg-primary/15 text-primary" : "bg-accent text-accent-foreground",
                  )}
                  aria-hidden
                >
                  {chatInitials(session.customerName)}
                </div>
                <button
                  type="button"
                  onClick={() => onSelect(session.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{session.customerName}</p>
                    <span className="shrink-0 font-mono text-[11px] tabular-nums">
                      {formatChatRelativeTime(session.updatedAt)}
                    </span>
                  </div>
                  <p className="truncate text-xs opacity-80">{session.matterLabel}</p>
                  {session.lastMessagePreview ? (
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed opacity-70">
                      {session.lastMessagePreview}
                    </p>
                  ) : null}
                </button>
                <button
                  type="button"
                  aria-label={`Delete conversation ${session.customerName}`}
                  title="Delete conversation"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(session.id);
                  }}
                  className={cn(
                    "text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive focus-visible:ring-ring mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full opacity-0 outline-none transition focus-visible:ring-2 group-hover:opacity-100 group-focus-within:opacity-100",
                    isActive && "opacity-100",
                  )}
                >
                  <TrashSimple className="size-3.5" aria-hidden />
                </button>
              </div>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="border-border/60 mt-auto space-y-2 border-t p-3">
        <p className="text-muted-foreground px-1 text-[11px]">{CHAT_COPY.sidebarFootnote}</p>
        <Link
          to="/dashboard/$firmSlug"
          params={{ firmSlug }}
          className={cn(
            "text-primary inline-flex items-center gap-1.5 px-1 text-sm font-medium hover:text-primary/80",
            CHAT_MOTION,
            "active:scale-[0.98]",
          )}
        >
          Open firm dashboard
          <ArrowSquareOut className="size-3.5" aria-hidden />
        </Link>
      </div>
    </aside>
  );
}

function MobileSessionTabs({
  sessions,
  activeSessionId,
  selectSession,
  createSession,
}: {
  sessions: DemoSession[];
  activeSessionId: string | null;
  selectSession: (id: string) => void;
  createSession: () => DemoSession;
}) {
  return (
    <div className="border-border/60 shrink-0 border-b p-2 md:hidden">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="flex gap-1.5 pr-2">
            {sessions.map((session) => {
              const isActive = session.id === activeSessionId;
              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => selectSession(session.id)}
                  className={cn(
                    "max-w-[11rem] shrink-0 truncate rounded-full px-3 py-2 text-xs font-medium",
                    CHAT_MOTION,
                    "active:scale-[0.98]",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted",
                  )}
                >
                  {session.customerName}
                </button>
              );
            })}
          </div>
        </div>
        <button
          type="button"
          onClick={createSession}
          className={cn(
            "border-border bg-card text-muted-foreground hover:bg-accent shrink-0 rounded-full border px-3 py-2 text-xs font-medium",
            CHAT_MOTION,
            "active:scale-[0.98]",
          )}
        >
          New
        </button>
      </div>
    </div>
  );
}

export function ChatShell({
  firmSlug,
  sessions,
  activeSession,
  activeSessionId,
  hydrated,
  selectSession,
  createSession,
  updateSession,
  deleteSession,
}: {
  firmSlug: string;
  sessions: DemoSession[];
  activeSession: DemoSession | null;
  activeSessionId: string | null;
  hydrated: boolean;
  selectSession: (id: string) => void;
  createSession: () => DemoSession;
  deleteSession: (sessionId: string) => void;
  updateSession: (sessionId: string, patch: Partial<DemoSession>) => void;
}) {
  const firmName = formatFirmSlug(firmSlug);
  const handleActiveSessionUpdate = useCallback(
    (patch: Partial<DemoSession>) => {
      if (activeSession) {
        updateSession(activeSession.id, patch);
      }
    },
    [activeSession, updateSession],
  );

  if (!hydrated) {
    return (
      <main className="bg-background h-dvh w-full overflow-hidden">
        <div className="flex h-full w-full flex-col md:flex-row">
          <div className="border-border/60 hidden w-64 shrink-0 border-r p-4 md:block">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-4 h-5 w-32" />
            <Skeleton className="mt-6 h-10 w-full rounded-lg" />
            <Skeleton className="mt-2 h-10 w-full rounded-lg" />
          </div>
          <div className="flex min-h-0 flex-1 flex-col p-4 md:p-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="mt-6 h-full min-h-[20rem] w-full rounded-xl" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-background h-dvh w-full overflow-hidden">
      <div className="flex h-full w-full flex-col bg-card md:flex-row">
        <div className="hidden md:block">
          <SessionSidebar
            firmSlug={firmSlug}
            sessions={sessions}
            activeSessionId={activeSessionId}
            firmName={firmName}
            onSelect={selectSession}
            onCreate={createSession}
            onDelete={deleteSession}
          />
        </div>

        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:border-border/60 md:border-l">
          <MobileSessionTabs
            sessions={sessions}
            activeSessionId={activeSessionId}
            selectSession={selectSession}
            createSession={createSession}
          />

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {activeSession ? (
              <ChatThread
                key={`${activeSession.id}:${activeSession.runtimeResetKey ?? 0}`}
                session={activeSession}
                onSessionUpdate={handleActiveSessionUpdate}
                onStartNewConversation={() => {
                  const nextSession = createSession();
                  selectSession(nextSession.id);
                }}
              />
            ) : (
              <div className="text-muted-foreground flex flex-1 items-center justify-center px-6 text-center text-sm">
                {CHAT_COPY.emptySelectSession}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
