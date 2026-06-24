import type { ReactNode } from "react";
import { dashboardEnterClass } from "../dashboard-utils";

export function DashboardPageHeader({
  eyebrow,
  title,
  description,
  actions,
  enterIndex = 0,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  enterIndex?: number;
}) {
  return (
    <header
      className={`border-border/60 flex flex-col gap-3 border-b px-4 py-5 sm:flex-row sm:items-start sm:justify-between md:px-6 ${dashboardEnterClass(enterIndex)}`}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <span className="text-muted-foreground text-[11px] font-medium tracking-[0.12em] uppercase">
            {eyebrow}
          </span>
        ) : null}
        <h2
          className={`text-foreground font-semibold tracking-tight ${eyebrow ? "mt-1.5" : ""} text-base`}
        >
          {title}
        </h2>
        {description ? (
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
