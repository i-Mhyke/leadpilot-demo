import { Circle } from "@phosphor-icons/react";
import type { UseEveAgentStatus } from "../use-flue-agent";
import { cn } from "@/lib/utils";
import { CHAT_COPY } from "../copy";

export function ChatStatusBar({
  status,
  matterLabel,
  customerName,
  errorMessage,
}: {
  status: UseEveAgentStatus;
  matterLabel: string;
  customerName: string;
  errorMessage?: string;
}) {
  const isLive = status === "streaming" || status === "submitted";

  return (
    <div className="border-border/60 bg-card flex shrink-0 items-center justify-between gap-4 border-b px-4 py-3.5 md:px-8">
      <div className="min-w-0">
        <p className="text-foreground truncate text-sm font-semibold tracking-tight">{customerName}</p>
        <p className="text-muted-foreground truncate text-xs">{CHAT_COPY.statusSubline(matterLabel)}</p>
      </div>
      <div
        className={cn(
          "flex shrink-0 flex-col items-end gap-1 rounded-full px-3 py-1 text-xs font-medium",
          status === "error" ? "bg-destructive/10 text-destructive" : "bg-accent text-accent-foreground",
        )}
      >
        <div className="flex items-center gap-2">
          {isLive ? <Circle className="size-2 fill-current animate-pulse" weight="fill" /> : null}
          <span>{CHAT_COPY.status[status]}</span>
        </div>
        {errorMessage ? <span className="max-w-[18rem] text-[11px] leading-relaxed">{errorMessage}</span> : null}
      </div>
    </div>
  );
}
