import { Skeleton } from "@/components/ui/skeleton";
import { ChatPanel } from "./chat-panel";

export function ChatReplyLoading() {
  return (
    <div className="flex justify-start">
      <ChatPanel className="w-full max-w-md" innerClassName="space-y-2.5 px-5 py-4">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-full max-w-sm" />
        <Skeleton className="h-3 w-4/5 max-w-xs" />
      </ChatPanel>
    </div>
  );
}
