import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { useCallback } from "react";
import type { FirmAgentProfile, FirmBrainConfig } from "@leadpilot/shared";
import { deleteChatConversation } from "@/features/chat/chat-actions";
import { ChatShell } from "@/features/chat/components/chat-shell";
import { useDemoSessions } from "@/features/chat/hooks/use-demo-sessions";
import { loadAskFirmPageState } from "@/features/chat/server";

export const Route = createFileRoute("/ask/$firmSlug")({
  loader: async ({ params }) => {
    return await loadAskFirmPageState({ data: { firmSlug: params.firmSlug } });
  },
  component: AskFirm,
});

function AskFirm() {
  const { firmProfile, brainConfig } = Route.useLoaderData();
  const { firmSlug } = Route.useParams();

  return (
    <ClientOnly fallback={<ChatShellLoading />}>
      <AskFirmClient firmSlug={firmSlug} firmProfile={firmProfile} brainConfig={brainConfig} />
    </ClientOnly>
  );
}

function AskFirmClient({
  firmSlug,
  firmProfile,
  brainConfig,
}: {
  firmSlug: string;
  firmProfile: FirmAgentProfile | null;
  brainConfig: FirmBrainConfig | null;
}) {
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
      firmProfile={firmProfile}
      brainConfig={brainConfig}
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
    <main className="bg-[#f4f5f7] h-dvh w-full overflow-hidden animate-pulse">
      <div className="flex h-full w-full flex-col md:flex-row md:p-4">
        <div className="border-border/50 hidden h-full w-[15.5rem] shrink-0 rounded-2xl border md:block" />
        <div className="h-full min-h-0 flex-1" />
      </div>
    </main>
  );
}
