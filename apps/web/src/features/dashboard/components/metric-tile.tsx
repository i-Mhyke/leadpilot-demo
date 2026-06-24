import { cn } from "@/lib/utils";
import { DASHBOARD_MOTION } from "../dashboard-utils";

export function MetricTile({
  label,
  value,
  hint,
  variant = "default",
  className,
}: {
  label: string;
  value: number;
  hint?: string;
  variant?: "default" | "featured" | "compact";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl bg-muted/25 p-1 ring-1 ring-border/40",
        DASHBOARD_MOTION,
        className,
      )}
    >
      <div
        className={cn(
          "rounded-[calc(0.75rem-0.125rem)] bg-card px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]",
          variant === "featured" ? "py-5" : variant === "compact" ? "py-2.5" : "py-3",
        )}
      >
        <p className="text-muted-foreground text-[11px] font-medium tracking-[0.08em] uppercase">
          {label}
        </p>
        <p
          className={cn(
            "text-foreground mt-1 font-mono font-semibold tracking-tight",
            variant === "featured" ? "text-3xl" : variant === "compact" ? "text-xl" : "text-2xl",
          )}
        >
          {value}
        </p>
        {hint ? <p className="text-muted-foreground mt-1 text-xs">{hint}</p> : null}
      </div>
    </div>
  );
}
