import { useCallback, useEffect, useRef, useState } from "react";
import { stripRawProviderThinkingFallback } from "@leadpilot/shared";
import type { FlueStreamEvent } from "../flue-session";
import { FlueSession } from "../flue-session";
import { useFlueAgent } from "../use-flue-agent";
import { getChatHistory, persistConversationTurn } from "../chat-actions";
import { assistantMessageText, chatErrorMessageForVisitor } from "../chat-utils";
import { CHAT_COPY } from "../copy";
import { ChatComposer } from "./chat-composer";
import { ChatErrorBanner } from "./chat-error-banner";
import { ChatMessage } from "./chat-message";
import { ChatPanel } from "./chat-panel";
import { ChatStatusBar } from "./chat-status-bar";
import { getAgentHost } from "@/lib/agent-host";
import { buildClientContextPayload } from "@/lib/leadpilot-client-context";
import { ChatTypingIndicator } from "./chat-typing-indicator";
import type { DemoSession } from "../hooks/use-demo-sessions";

export function ChatThread({ session, onSessionUpdate, onStartNewConversation }: {
  session: DemoSession;
  onSessionUpdate: (patch: Partial<DemoSession>) => void;
  onStartNewConversation?: () => void;
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
    { host: getAgentHost(), headers: () => ({ "x-leadpilot-client-context": JSON.stringify(buildClientContextPayload({ firmSlug: session.firmSlug, browserSessionId: session.id, sourceUrl: location.href })) }) },
    undefined,
  ));

  const agent = useFlueAgent({
    session: flueSession.current,
    initialEvents: initialEvents.length > 0 ? initialEvents : undefined,
    onFinish: async (snapshot) => {
      const userMsg = snapshot.data.messages.find(m => m.role === "user");
      const assistantMsg = snapshot.data.messages.find(m => m.role === "assistant");
      const preview = stripRawProviderThinkingFallback(assistantMsg?.parts.find(p => p.type === "text")?.text ?? "");
      if (preview) onSessionUpdate({ lastMessagePreview: preview.slice(0, 140) });
      if (userMsg && assistantMsg) {
        const userText = userMsg.parts.find(p => p.type === "text")?.text ?? "";
        const assistantText = assistantMsg.parts.find(p => p.type === "text")?.text ?? "";
        void persistConversationTurn({
          data: {
            firmSlug: session.firmSlug,
            browserSessionId: session.id,
            userMessage: userText,
            assistantMessage: assistantText,
            sessionId: flueSession.current.state.sessionId ?? "",
          },
        }).then(() => {
          console.log("[persistConversationTurn] saved turn for", session.id);
        }).catch((err) => {
          console.error("[persistConversationTurn] FAILED for", session.id, err);
        });
      }
    },
    onSessionChange: (cursor) => {
      if (cursor?.sessionId) onSessionUpdate({ sessionCursor: { streamIndex: cursor.streamIndex, sessionId: cursor.sessionId } });
    },
  });

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [agent.data.messages, agent.status]);

  if (loading) return (
    <section className="bg-card flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="border-border/60 shrink-0 border-b px-4 py-3.5 md:px-8">
        <p className="text-foreground text-sm font-semibold tracking-tight">{session.customerName}</p>
        <p className="text-muted-foreground mt-0.5 text-xs">{session.matterLabel}</p>
      </div>
    </section>
  );

  const isBusy = agent.status === "submitted" || agent.status === "streaming";
  const hasError = agent.status === "error" || Boolean(agent.error?.message);
  const isEmpty = agent.data.messages.length === 0 && !isBusy && !hasError;
  const lastAssistantMsg = [...agent.data.messages].reverse().find(m => m.role === "assistant");
  const pendingText = lastAssistantMsg ? assistantMessageText(lastAssistantMsg) : "";
  const showLoading = !hasError && (agent.status === "submitted" || (agent.status === "streaming" && pendingText.length === 0));
  const statusText = hasError ? "error" : showLoading ? "submitted" : agent.status;

  return (
    <section className="bg-card flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="border-border/60 shrink-0 border-b px-4 py-3.5 md:px-8">
        <p className="text-foreground text-sm font-semibold tracking-tight">{session.customerName}</p>
        <p className="text-muted-foreground mt-0.5 text-xs">{session.matterLabel}</p>
      </div>

      {isEmpty ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
            <span className="bg-accent/80 text-accent-foreground inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-medium tracking-[0.14em] uppercase">
              Before you book
            </span>
            <h2 className="text-foreground mt-4 text-lg font-semibold tracking-tight">
              {CHAT_COPY.emptyStateTitle}
            </h2>
            <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm leading-relaxed">
              {CHAT_COPY.emptyStateBody}
            </p>
          </div>

          <div className="px-6 pb-2">
            <p className="text-muted-foreground text-xs font-medium tracking-[0.06em] uppercase">
              {CHAT_COPY.suggestedPromptsLabel}
            </p>
          </div>

          <div className="flex flex-col gap-2 px-6 pb-6">
            {CHAT_COPY.suggestedPrompts.map((prompt, index) => (
              <button
                key={index}
                type="button"
                onClick={() => agent.send(prompt)}
                disabled={isBusy}
                className="border-border/60 hover:bg-muted/50 text-foreground active:scale-[0.99] flex w-full items-start gap-2 rounded-xl border p-4 text-left text-sm leading-relaxed transition-all duration-150"
              >
                <span className="text-muted-foreground mt-0.5 shrink-0 font-mono text-xs tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>{prompt}</span>
              </button>
            ))}
          </div>

          <div className="border-border/60 shrink-0 border-t px-4 pb-4 pt-4 md:px-8 md:pb-6">
            <div className="mx-auto max-w-2xl">
              <ChatPanel>
                <ChatComposer
                  onSend={(text: string) => agent.send(text)}
                  disabled={isBusy}
                  isStreaming={isBusy}
                  placeholder={CHAT_COPY.composerPlaceholder}
                />
              </ChatPanel>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
            <div className="mx-auto flex max-w-2xl flex-col gap-6">
              {agent.data.messages.filter((m) => m.role !== "assistant" || assistantMessageText(m).length > 0).map((msg, i) => (
                <ChatMessage key={i} message={msg} />
              ))}
            </div>
            {showLoading && <ChatTypingIndicator />}
          </div>

          <ChatStatusBar status={statusText} matterLabel={session.matterLabel} customerName={session.customerName} errorMessage={undefined} />

          <div className="shrink-0 px-4 pb-4 md:px-8 md:pb-6">
            <div className="mx-auto max-w-2xl">
              <ChatPanel>
                {hasError && !isBusy ? (
                  <ChatErrorBanner
                    message={chatErrorMessageForVisitor(agent.error?.message) ?? agent.error?.message ?? "Error"}
                    onRetry={() => { onSessionUpdate({ runtimeResetKey: Date.now() }); }}
                    onStartNew={onStartNewConversation}
                  />
                ) : (
                  <ChatComposer
                    onSend={(text: string) => agent.send(text)}
                    disabled={isBusy && !hasError}
                    isStreaming={isBusy}
                  />
                )}
              </ChatPanel>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
