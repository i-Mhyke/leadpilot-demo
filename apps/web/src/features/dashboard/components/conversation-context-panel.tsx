import type { ConversationContextMessage } from "@leadpilot/shared";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatDashboardWhen } from "../dashboard-utils";
import { DashboardPanel } from "./dashboard-panel";

export function ConversationContextPanel({
  messages,
  messageCount,
  previewLimit,
}: {
  messages: ConversationContextMessage[];
  messageCount: number;
  previewLimit: number;
}) {
  return (
    <DashboardPanel innerClassName="flex min-h-0 flex-col">
      <div className="border-border/60 border-b px-4 py-3 md:px-5">
        <h3 className="text-foreground text-sm font-semibold tracking-tight">Conversation context</h3>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Recent visitor and assistant messages from the intake chat.
        </p>
      </div>

      {messages.length === 0 ? (
        <div className="text-muted-foreground px-4 py-8 text-center text-sm md:px-5">
          No recent conversation context
        </div>
      ) : (
        <ScrollArea className="max-h-[min(32rem,60vh)]">
          <div className="space-y-3 px-4 py-4 md:px-5">
            {messages.map((message) => (
              <ContextMessage key={message.id} message={message} />
            ))}
          </div>
        </ScrollArea>
      )}

      {messageCount > 0 ? (
        <div className="border-border/60 text-muted-foreground border-t px-4 py-2.5 text-xs md:px-5">
          Showing{" "}
          <span className="text-foreground font-mono tabular-nums">
            {Math.min(messages.length, previewLimit)}
          </span>{" "}
          of <span className="text-foreground font-mono tabular-nums">{messageCount}</span> messages
        </div>
      ) : null}
    </DashboardPanel>
  );
}

function ContextMessage({ message }: { message: ConversationContextMessage }) {
  const isVisitor = message.role === "visitor";

  return (
    <div className={cn("flex", isVisitor ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[min(92%,28rem)] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
          isVisitor
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted/50 text-foreground ring-border/50 rounded-bl-md ring-1",
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        <p
          className={cn(
            "mt-1.5 text-[10px] font-mono tabular-nums",
            isVisitor ? "text-primary-foreground/75" : "text-muted-foreground",
          )}
        >
          {formatDashboardWhen(message.createdAt)}
        </p>
      </div>
    </div>
  );
}
