import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function DashboardPanel({
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

export function DashboardListPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <DashboardPanel innerClassName={cn("divide-border/60 divide-y", className)}>
      {children}
    </DashboardPanel>
  );
}

export function DashboardEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <DashboardPanel>
      <div className="px-4 py-10 text-center md:px-6">
        <p className="text-foreground text-sm font-medium">{title}</p>
        <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">{description}</p>
      </div>
    </DashboardPanel>
  );
}
