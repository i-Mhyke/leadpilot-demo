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
  enterIndex?: 0 | number;
}) {
  return (
    <header
      className={`border-border/50 flex flex-col gap-4 border-b px-5 py-6 md:px-7 md:py-7 lg:flex-row lg:items-end lg:justify-between ${dashboardEnterClass(enterIndex)}`}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <span className="text-muted-foreground text-[11px] font-medium tracking-[0.12em] uppercase">
            {eyebrow}
          </span>
        ) : null}
        <h2
          className={`text-foreground font-semibold tracking-tight ${eyebrow ? "mt-1.5" : ""} text-2xl md:text-[1.75rem]`}
        >
          {title}
        </h2>
        {description ? (
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
