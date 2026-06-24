import {
  Article,
  ArrowSquareOut,
  ChatsCircle,
  SquaresFour,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import type { FirmDashboardOverview } from "@leadpilot/shared";
import { cn } from "@/lib/utils";
import { DASHBOARD_MOTION } from "../dashboard-utils";

const NAV_ITEMS = [
  {
    to: "/dashboard/$firmSlug" as const,
    label: "Overview",
    icon: SquaresFour,
    exact: true,
    countKey: null,
  },
  {
    to: "/dashboard/$firmSlug/leads" as const,
    label: "Leads",
    icon: ChatsCircle,
    exact: false,
    countKey: "conversationsTotal" as const,
  },
  {
    to: "/dashboard/$firmSlug/content" as const,
    label: "Content",
    icon: Article,
    exact: false,
    countKey: null,
  },
] as const;

function navLinkClass(isActive: boolean) {
  return cn(
    "group relative flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium",
    DASHBOARD_MOTION,
    "active:scale-[0.98]",
    isActive
      ? "bg-primary/10 text-primary"
      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
  );
}

export function DashboardSidebar({
  firmSlug,
  overview,
}: {
  firmSlug: string;
  overview: FirmDashboardOverview;
}) {
  return (
    <aside className="border-border/60 flex w-full flex-col border-b lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:shrink-0 lg:border-r lg:border-b-0">
      <div className="border-border/60 border-b px-4 py-5 lg:px-4">
        <span className="bg-accent/80 text-accent-foreground inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-medium tracking-[0.14em] uppercase">
          Firm workspace
        </span>
        <h1 className="text-foreground mt-3 text-sm font-semibold tracking-tight">
          {overview.firm.name}
        </h1>
        <p className="text-muted-foreground mt-1 font-mono text-[11px]">{firmSlug}</p>
      </div>

      <nav className="flex flex-col gap-1 px-3 py-4" aria-label="Dashboard">
        {NAV_ITEMS.map((item) => {
          const count =
            item.countKey != null ? overview.metrics[item.countKey] : undefined;

          return (
            <Link
              key={item.to}
              to={item.to}
              params={{ firmSlug }}
              activeOptions={{ exact: item.exact }}
              className={navLinkClass(false)}
              activeProps={{ className: navLinkClass(true) }}
            >
              <item.icon className="size-4 shrink-0" weight="duotone" aria-hidden />
              <span>{item.label}</span>
              {count != null && count > 0 ? (
                <span className="text-muted-foreground ml-auto font-mono text-[11px] tabular-nums">
                  {count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-border/60 mt-auto border-t p-3">
        <Link
          to="/ask/$firmSlug"
          params={{ firmSlug }}
          className={cn(
            "text-primary inline-flex items-center gap-1.5 text-sm font-medium hover:text-primary/80",
            DASHBOARD_MOTION,
            "active:scale-[0.98]",
          )}
        >
          Open ask page
          <ArrowSquareOut className="size-3.5" aria-hidden />
        </Link>
      </div>
    </aside>
  );
}
