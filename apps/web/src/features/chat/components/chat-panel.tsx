import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ChatPanel({
  children,
  className,
  innerClassName,
}: {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl bg-muted/30 p-1 ring-1 ring-border/40 shadow-[0_24px_80px_-48px_rgba(28,35,41,0.18)]",
        className,
      )}
    >
      <div
        className={cn(
          "rounded-[calc(0.75rem-0.125rem)] bg-card shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]",
          innerClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
