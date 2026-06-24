import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { useCallback } from "react";
import { deleteChatConversation } from "@/features/chat/chat-actions";
import { ChatShell } from "@/features/chat/components/chat-shell";
import { useDemoSessions } from "@/features/chat/hooks/use-demo-sessions";

export const Route = createFileRoute("/ask/$firmSlug")({
  component: AskFirm,
});

function AskFirm() {
  const { firmSlug } = Route.useParams();

  return (
    <ClientOnly fallback={<ChatShellLoading />}>
      <AskFirmClient firmSlug={firmSlug} />
    </ClientOnly>
  );
}

function AskFirmClient({ firmSlug }: { firmSlug: string }) {
  const demo = useDemoSessions(firmSlug);
  const deleteSession = useCallback(
    async (sessionId: string) => {
      const session = demo.sessions.find((item) => item.id === sessionId);
      await deleteChatConversation({
        data: {
          firmSlug,
          browserSessionId: sessionId,
          conversationId: session?.conversationId,
        },
      });
      demo.deleteSession(sessionId);
    },
    [demo, firmSlug],
  );

  return (
    <ChatShell
      firmSlug={firmSlug}
      sessions={demo.sessions}
      activeSession={demo.activeSession}
      activeSessionId={demo.activeSessionId}
      hydrated={demo.hydrated}
      selectSession={demo.selectSession}
      createSession={demo.createSession}
      deleteSession={deleteSession}
      updateSession={demo.updateSession}
    />
  );
}

function ChatShellLoading() {
  return (
    <main className="bg-background h-dvh w-full overflow-hidden animate-pulse">
      <div className="flex h-full w-full bg-card">
        <div className="border-border/60 hidden w-64 shrink-0 border-r md:block" />
        <div className="min-h-0 flex-1" />
      </div>
    </main>
  );
}
