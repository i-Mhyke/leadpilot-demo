import { useEffect, useRef } from "react";
import { Avatar } from "@/components/ui/avatar";

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="size-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="size-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
      <span className="size-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
    </span>
  );
}

export function ChatTypingIndicator() {
  return (
    <div className="flex items-start gap-3 px-4 py-4 md:px-8">
      <Avatar className="border-border/40 size-8 shrink-0 rounded-full border">
        <div className="bg-primary/10 text-primary flex size-full items-center justify-center text-[11px] font-semibold">
          LP
        </div>
      </Avatar>
      <div className="flex min-w-0 flex-col gap-1 pt-1">
        <p className="text-muted-foreground text-xs font-medium">Customer service agent</p>
        <p className="text-muted-foreground/70 inline-flex items-center gap-1.5 text-sm">
          typing
          <TypingDots />
        </p>
      </div>
    </div>
  );
}
