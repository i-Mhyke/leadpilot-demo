import { useCallback } from "react";
import { ArrowSquareOut, Plus, TrashSimple } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatFirmSlug } from "@/lib/format-firm-slug";
import { cn } from "@/lib/utils";
import type { FirmAgentProfile, FirmBrainConfig } from "@leadpilot/shared";
import { CHAT_MOTION, chatEnterClass, chatInitials, formatChatRelativeTime } from "../chat-utils";
import { CHAT_COPY, resolveAskPageCopy } from "../copy";
import type { DemoSession } from "../hooks/use-demo-sessions";
import { ChatThread } from "./chat-thread";

function DashboardLink({
  firmSlug,
  className,
}: {
  firmSlug: string;
  className?: string;
}) {
  return (
    <Link
      to="/dashboard/$firmSlug"
      params={{ firmSlug }}
      className={cn(
        "text-foreground/80 hover:text-foreground inline-flex items-center gap-2 rounded-lg px-2 py-2 text-[13px] font-medium",
        CHAT_MOTION,
        "hover:bg-card/70 active:scale-[0.98]",
        className,
      )}
    >
      Open firm dashboard
      <ArrowSquareOut className="ml-auto size-3.5" aria-hidden />
    </Link>
  );
}

function MobileDashboardButton({ firmSlug }: { firmSlug: string }) {
  return (
    <Button
      asChild
      size="sm"
      variant="secondary"
      className={cn("shrink-0 rounded-full px-3.5", CHAT_MOTION, "active:scale-[0.98]")}
    >
      <Link to="/dashboard/$firmSlug" params={{ firmSlug }}>
        Dashboard
        <ArrowSquareOut className="size-3.5" aria-hidden />
      </Link>
    </Button>
  );
}
function DashboardCaptureNote({ className }: { className?: string }) {
  return (
    <p className={cn("text-muted-foreground text-[11px] leading-relaxed", className)}>
      {CHAT_COPY.dashboardCaptureNote}
    </p>
  );
}

function MobileChatHeader({ firmName, firmSlug }: { firmName: string; firmSlug: string }) {
  return (
    <div className="border-border/50 shrink-0 border-b bg-[#fbfbfc] px-4 py-3 md:hidden">
      <div className="flex items-center justify-between gap-3">
        <p className="text-foreground min-w-0 truncate text-sm font-semibold tracking-tight">{firmName}</p>
        <MobileDashboardButton firmSlug={firmSlug} />
      </div>
      <DashboardCaptureNote className="mt-2" />
    </div>
  );
}
function SessionSidebar({
  firmSlug,
  firmName,
  sessions,
  activeSessionId,
  onSelect,
  onCreate,
  onDelete,
}: {
  firmSlug: string;
  firmName: string;
  sessions: DemoSession[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <aside className="flex h-full min-h-0 w-full flex-col bg-[#f0f1f3] md:w-[15.5rem] md:shrink-0">
      <div className="px-4 py-5">
        <div className="flex items-center gap-2.5">
          <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg text-xs font-semibold tracking-tight">
            LP
          </div>
          <div className="min-w-0">
            <p className="text-foreground truncate text-sm font-semibold tracking-tight">{CHAT_COPY.shellTitle}</p>
            <p className="text-muted-foreground truncate text-xs">{firmName}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 px-3 pb-2">
        <p className="text-muted-foreground px-1 text-[10px] font-medium tracking-[0.14em] uppercase">
          {CHAT_COPY.sidebarTitle}
        </p>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className={cn("text-muted-foreground rounded-full", CHAT_MOTION, "active:scale-[0.98]")}
          onClick={onCreate}
          aria-label="New conversation"
        >
          <Plus className="size-4" weight="bold" />
        </Button>
      </div>

      <nav
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 pb-3"
        aria-label="Conversations"
      >
        <div className="flex flex-col gap-0.5">
          {sessions.map((session, index) => {
            const isActive = session.id === activeSessionId;
            return (
              <div
                key={session.id}
                className={cn(
                  "group flex w-full min-w-0 items-start gap-2 rounded-lg px-2.5 py-2.5",
                  CHAT_MOTION,
                  chatEnterClass(index + 1),
                  isActive
                    ? "bg-card text-foreground shadow-[inset_0_0_0_1px_rgba(28,35,41,0.06)]"
                    : "text-muted-foreground hover:bg-card/70 hover:text-foreground",
                )}
              >
                <div
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                    isActive ? "bg-primary/12 text-primary" : "bg-muted text-foreground/70",
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
                    <p className="truncate text-[13px] font-medium">{session.customerName}</p>
                    <span className="shrink-0 font-mono text-[10px] tabular-nums opacity-70">
                      {formatChatRelativeTime(session.updatedAt)}
                    </span>
                  </div>
                  <p className="truncate text-xs opacity-80">{session.matterLabel}</p>
                  {session.lastMessagePreview ? (
                    <p className="mt-0.5 line-clamp-1 text-[11px] leading-relaxed opacity-60">
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
                    "text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive focus-visible:ring-ring mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full opacity-0 outline-none transition focus-visible:ring-2 group-hover:opacity-100 group-focus-within:opacity-100",
                    isActive && "opacity-100",
                  )}
                >
                  <TrashSimple className="size-3.5" aria-hidden />
                </button>
              </div>
            );
          })}
        </div>
      </nav>

      <div className="mt-auto space-y-2 border-t border-border/50 p-3">
        <p className="text-muted-foreground px-1 text-[11px]">{CHAT_COPY.sidebarFootnote}</p>
        <DashboardCaptureNote className="px-1" />
        <DashboardLink firmSlug={firmSlug} className="w-full" />
      </div>
    </aside>
  );
}

export function ChatShell({
  firmSlug,
  firmProfile,
  brainConfig,
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
  firmProfile?: FirmAgentProfile | null;
  brainConfig?: FirmBrainConfig | null;
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
  const displayFirmName = firmProfile?.firm.name ?? firmName;
  const askCopy = resolveAskPageCopy({ firmName: displayFirmName, brainConfig: brainConfig ?? null });
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
      <main className="bg-[#f4f5f7] h-dvh w-full overflow-hidden">
        <div className="flex h-full w-full flex-col md:flex-row md:p-4">
          <div className="hidden w-[15.5rem] shrink-0 p-4 md:block">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-4 h-5 w-32" />
            <Skeleton className="mt-6 h-10 w-full rounded-lg" />
          </div>
          <div className="flex h-full min-h-0 flex-1 flex-col p-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="mt-6 h-full min-h-0 w-full rounded-2xl" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-[#f4f5f7] h-dvh w-full overflow-hidden">
      <div className="flex h-full min-h-0 w-full flex-col md:flex-row md:gap-0 md:p-4">
        <div className="hidden h-full min-h-0 md:flex md:shrink-0">
          <div className="border-border/50 bg-card flex h-full w-[15.5rem] flex-col overflow-hidden rounded-2xl border shadow-[0_20px_40px_-24px_rgba(28,35,41,0.18)]">
            <SessionSidebar
              firmSlug={firmSlug}
              firmName={displayFirmName}
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSelect={selectSession}
              onCreate={createSession}
              onDelete={deleteSession}
            />
          </div>
        </div>

        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:pl-4">
          <div className="border-border/50 bg-card flex h-full min-h-0 flex-col overflow-hidden rounded-none border-0 md:rounded-2xl md:border md:shadow-[0_20px_40px_-24px_rgba(28,35,41,0.18)]">
            <MobileChatHeader firmName={displayFirmName} firmSlug={firmSlug} />

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
                  copy={askCopy}
                />
              ) : (
                <div className="text-muted-foreground flex flex-1 items-center justify-center px-6 text-center text-sm">
                  {CHAT_COPY.emptySelectSession}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
