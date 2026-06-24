import { useCallback, useEffect, useRef, useState } from "react";
import { Circle } from "@phosphor-icons/react";
import { stripRawProviderThinkingFallback } from "@leadpilot/shared";
import type { FlueStreamEvent } from "../flue-session";
import { FlueSession } from "../flue-session";
import { useFlueAgent } from "../use-flue-agent";
import { getChatHistory, persistBookingSelection, persistConversationTurn } from "../chat-actions";
import { assistantMessageText, chatErrorMessageForVisitor, CHAT_MOTION } from "../chat-utils";
import { CHAT_COPY } from "../copy";
import { ChatComposer } from "./chat-composer";
import { ChatErrorBanner } from "./chat-error-banner";
import { ChatMessage } from "./chat-message";
import { getAgentHost } from "@/lib/agent-host";
import { buildClientContextPayload } from "@/lib/leadpilot-client-context";
import { buildBookingMessage, formatBookingDateTimeLabel } from "../booking-datetime";
import { ChatTypingIndicator } from "./chat-typing-indicator";
import type { DemoSession } from "../hooks/use-demo-sessions";
import type { AskPageCopy } from "../copy";
import { cn } from "@/lib/utils";
import { shouldShowBookingScheduleButton } from "../booking-datetime";

function ThreadHeader({
  title,
  subtitle,
  status,
}: {
  title: string;
  subtitle: string;
  status?: "idle" | "submitted" | "streaming" | "error" | "done";
}) {
  const isLive = status === "streaming" || status === "submitted";

  return (
    <div className="border-border/50 flex shrink-0 items-center justify-between gap-4 border-b px-5 py-4 md:px-7">
      <div className="min-w-0">
        <p className="text-foreground truncate text-sm font-semibold tracking-tight">{title}</p>
        <p className="text-muted-foreground mt-0.5 truncate text-xs">{subtitle}</p>
      </div>
      {status && status !== "idle" && status !== "done" ? (
        <div
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
            status === "error"
              ? "bg-destructive/10 text-destructive"
              : "bg-muted text-muted-foreground",
          )}
        >
          {isLive ? <Circle className="size-2 fill-current animate-pulse" weight="fill" /> : null}
          <span>{CHAT_COPY.status[status]}</span>
        </div>
      ) : null}
    </div>
  );
}

function SuggestedPrompts({
  copy,
  disabled,
  onSelect,
}: {
  copy: AskPageCopy;
  disabled: boolean;
  onSelect: (prompt: string) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-[11px] font-medium tracking-[0.12em] uppercase">
        {copy.suggestedPromptsLabel}
      </p>
      <div className="divide-border/60 divide-y rounded-xl border border-border/50">
        {copy.suggestedPrompts.map((prompt, index) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onSelect(prompt)}
            disabled={disabled}
            className={cn(
              "hover:bg-muted/40 text-foreground flex w-full items-start gap-3 px-4 py-3.5 text-left text-sm leading-relaxed first:rounded-t-xl last:rounded-b-xl",
              CHAT_MOTION,
              "active:scale-[0.995] disabled:opacity-60",
            )}
          >
            <span className="text-muted-foreground mt-0.5 shrink-0 font-mono text-[11px] tabular-nums">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span>{prompt}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ComposerFooter({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="border-border/50 bg-[#fbfbfc] shrink-0 border-t px-4 py-4 md:px-7 md:py-5">
      <div className="mx-auto w-full max-w-2xl">{children}</div>
    </div>
  );
}

export function ChatThread({ session, onSessionUpdate, onStartNewConversation, copy }: {
  session: DemoSession;
  onSessionUpdate: (patch: Partial<DemoSession>) => void;
  onStartNewConversation?: () => void;
  copy: AskPageCopy;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [initialEvents, setInitialEvents] = useState<FlueStreamEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const history = await getChatHistory({
          data: { firmSlug: session.firmSlug, browserSessionId: session.id, conversationId: session.conversationId },
        });
        if (!cancelled && history.messages.length > 0) {
          const events = history.messages.map((m: any) => ({
            type: "message_end" as const,
            data: { message: { role: m.role === "visitor" ? "user" : m.role, text: m.content } },
          }));
          setInitialEvents(events);
        }
      } catch { /* noop */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [session.id]);

  const flueSession = useRef(new FlueSession(
    {
      host: getAgentHost(),
      firmSlug: session.firmSlug,
      browserSessionId: session.id,
      headers: () => ({
        "x-leadpilot-client-context": JSON.stringify(
          buildClientContextPayload({
            firmSlug: session.firmSlug,
            browserSessionId: session.id,
            sourceUrl: location.href,
          }),
        ),
      }),
    },
    session.sessionCursor
      ? {
          sessionId: session.sessionCursor.sessionId,
          streamIndex: session.sessionCursor.streamIndex,
          continuationToken: session.sessionCursor.continuationToken,
          needsReconciliation: session.sessionCursor.needsReconciliation,
        }
      : undefined,
  ));

  const handleSessionChange = useCallback(
    (cursor: { streamIndex: number; sessionId?: string }) => {
      if (!cursor.sessionId) return;
      const current = session.sessionCursor;
      if (
        current?.sessionId === cursor.sessionId &&
        current.streamIndex === cursor.streamIndex
      ) {
        return;
      }
      onSessionUpdate({
        sessionCursor: {
          ...current,
          streamIndex: cursor.streamIndex,
          sessionId: cursor.sessionId,
        },
      });
    },
    [onSessionUpdate, session.sessionCursor],
  );

  const handleFinish = useCallback(
    async (snapshot: {
      data: { messages: Array<{ role: string; parts: Array<{ type: string; text?: string }> }> };
      session: { streamIndex: number; sessionId?: string };
    }) => {
      const userMsg = snapshot.data.messages.find((m) => m.role === "user");
      const assistantMsg = snapshot.data.messages.find((m) => m.role === "assistant");
      const preview = stripRawProviderThinkingFallback(
        assistantMsg?.parts.find((p) => p.type === "text")?.text ?? "",
      );
      if (preview) onSessionUpdate({ lastMessagePreview: preview.slice(0, 140) });
      if (userMsg && assistantMsg) {
        const userText = userMsg.parts.find((p) => p.type === "text")?.text ?? "";
        const assistantText = assistantMsg.parts.find((p) => p.type === "text")?.text ?? "";
        void persistConversationTurn({
          data: {
            firmSlug: session.firmSlug,
            browserSessionId: session.id,
            userMessage: userText,
            assistantMessage: assistantText,
            sessionId: flueSession.current.state.sessionId ?? "",
          },
        })
          .then((result) => {
            if (result.conversationId) {
              onSessionUpdate({ conversationId: result.conversationId });
            }
          })
          .catch((err) => {
            console.error("[persistConversationTurn] FAILED for", session.id, err);
          });
      }
    },
    [onSessionUpdate, session.firmSlug, session.id],
  );

  const agent = useFlueAgent({
    session: flueSession.current,
    initialEvents: initialEvents.length > 0 ? initialEvents : undefined,
    onFinish: handleFinish,
    onSessionChange: handleSessionChange,
  });

  async function handleBookingConfirm(dateTime: Date) {
    const preferredBookingAt = dateTime.toISOString();
    const preferredBookingLabel = formatBookingDateTimeLabel(dateTime);
    const existingSessionId = flueSession.current.state.sessionId;
    if (existingSessionId) {
      await persistBookingSelection({
        data: {
          firmSlug: session.firmSlug,
          browserSessionId: session.id,
          sessionId: existingSessionId,
          preferredBookingAt,
          preferredBookingLabel,
        },
      });
    }

    const sendResult = await agent.send({
      message: buildBookingMessage(dateTime),
      inputResponses: [
        {
          type: "booking_datetime",
          preferredBookingAt,
          preferredBookingLabel,
        },
      ],
    });
    const sessionId = existingSessionId ?? sendResult?.sessionId ?? flueSession.current.state.sessionId;
    if (!existingSessionId && sessionId) {
      await persistBookingSelection({
        data: {
          firmSlug: session.firmSlug,
          browserSessionId: session.id,
          sessionId,
          preferredBookingAt,
          preferredBookingLabel,
        },
      });
    }
  }

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [agent.data.messages, agent.status]);

  if (loading) {
    return (
      <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
        <ThreadHeader title={session.customerName} subtitle={session.matterLabel} />
        <div className="min-h-0 flex-1" aria-hidden />
      </section>
    );
  }

  const isBusy = agent.status === "submitted" || agent.status === "streaming";
  const hasError = agent.status === "error" || Boolean(agent.error?.message);
  const isEmpty = agent.data.messages.length === 0 && !isBusy && !hasError;
  const lastAssistantMsg = [...agent.data.messages].reverse().find(m => m.role === "assistant");
  const pendingText = lastAssistantMsg ? assistantMessageText(lastAssistantMsg) : "";
  const bookingScheduleRequested = Boolean(
    (lastAssistantMsg?.metadata as { ui?: { bookingScheduleRequested?: boolean } } | undefined)?.ui
      ?.bookingScheduleRequested,
  ) || shouldShowBookingScheduleButton(pendingText);
  const showLoading = !hasError && (agent.status === "submitted" || (agent.status === "streaming" && pendingText.length === 0));
  const statusText = hasError ? "error" : showLoading ? "submitted" : agent.status;

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <ThreadHeader
        title={session.customerName}
        subtitle={session.matterLabel}
        status={isEmpty ? undefined : statusText}
      />

      {isEmpty ? (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
            <div className="mx-auto w-full max-w-2xl px-5 py-8 md:px-7 md:py-10">
              <span className="text-muted-foreground text-[11px] font-medium tracking-[0.12em] uppercase">
                Before you book
              </span>
              <h2 className="text-foreground mt-3 text-xl font-semibold tracking-tight md:text-2xl">
                {copy.emptyStateTitle}
              </h2>
              <p className="text-muted-foreground mt-3 max-w-xl text-sm leading-relaxed">
                {copy.emptyStateBody}
              </p>

              <div className="mt-8">
                <SuggestedPrompts
                  copy={copy}
                  disabled={isBusy}
                  onSelect={(prompt) => agent.send(prompt)}
                />
              </div>
            </div>
          </div>

          <ComposerFooter>
            <ChatComposer
              onSend={(text: string) => agent.send(text)}
              bookingScheduleRequested={bookingScheduleRequested}
              onBookingConfirm={(dateTime) => {
                void handleBookingConfirm(dateTime);
              }}
              disabled={isBusy}
              isStreaming={isBusy}
              placeholder={copy.composerPlaceholder}
            />
          </ComposerFooter>
        </>
      ) : (
        <>
          <div
            ref={scrollRef}
            className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-6 md:px-7 md:py-8"
          >
            <div className="mx-auto flex max-w-2xl flex-col gap-5">
              {agent.data.messages.filter((m) => m.role !== "assistant" || assistantMessageText(m).length > 0).map((msg, i) => (
                <ChatMessage key={i} message={msg} />
              ))}
            </div>
            {showLoading ? <ChatTypingIndicator /> : null}
          </div>

          {!isEmpty && hasError && !isBusy ? (
            <div className="border-border/50 shrink-0 border-t px-4 py-3 md:px-7">
              <div className="mx-auto max-w-2xl">
                <ChatErrorBanner
                  message={chatErrorMessageForVisitor(agent.error?.message) ?? agent.error?.message ?? "Error"}
                  onRetry={() => { onSessionUpdate({ runtimeResetKey: Date.now() }); }}
                  onStartNew={onStartNewConversation}
                />
              </div>
            </div>
          ) : null}

          <ComposerFooter>
            {!hasError || isBusy ? (
              <ChatComposer
                onSend={(text: string) => agent.send(text)}
                bookingScheduleRequested={bookingScheduleRequested}
                onBookingConfirm={(dateTime) => {
                  void handleBookingConfirm(dateTime);
                }}
                disabled={isBusy && !hasError}
                isStreaming={isBusy}
                placeholder={copy.composerPlaceholder}
              />
            ) : null}
          </ComposerFooter>
        </>
      )}
    </section>
  );
}
