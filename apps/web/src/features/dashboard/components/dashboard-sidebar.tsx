import {
  Article,
  ArrowSquareOut,
  ChatsCircle,
  SquaresFour,
  UserList,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import type { FirmDashboardOverview } from "@leadpilot/shared";
import { cn } from "@/lib/utils";
import { DASHBOARD_MOTION } from "../dashboard-utils";

const PRIMARY_NAV = [
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
    icon: UserList,
    exact: false,
    countKey: "newLeads" as const,
  },
  {
    to: "/dashboard/$firmSlug/conversations" as const,
    label: "Conversations",
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
    "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium",
    DASHBOARD_MOTION,
    "active:scale-[0.98]",
    isActive
      ? "bg-card text-foreground shadow-[inset_0_0_0_1px_rgba(28,35,41,0.06)]"
      : "text-muted-foreground hover:bg-card/70 hover:text-foreground",
  );
}

function NavCount({ count }: { count: number }) {
  return (
    <span className="text-muted-foreground ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-muted/80 px-1.5 py-0.5 font-mono text-[10px] tabular-nums">
      {count}
    </span>
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
    <aside className="flex w-full flex-col border-border/50 bg-[#f0f1f3] lg:sticky lg:top-0 lg:h-dvh lg:w-[15.5rem] lg:shrink-0 lg:border-r">
      <div className="px-4 py-5">
        <div className="flex items-center gap-2.5">
          <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg text-xs font-semibold tracking-tight">
            LP
          </div>
          <div className="min-w-0">
            <p className="text-foreground truncate text-sm font-semibold tracking-tight">
              {overview.firm.name}
            </p>
            <p className="text-muted-foreground truncate font-mono text-[10px]">{firmSlug}</p>
          </div>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5 px-3" aria-label="Dashboard">
        <p className="text-muted-foreground px-3 pb-2 text-[10px] font-medium tracking-[0.14em] uppercase">
          Operations
        </p>
        {PRIMARY_NAV.map((item) => {
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
              <item.icon className="size-4 shrink-0" weight={item.exact ? "fill" : "regular"} aria-hidden />
              <span>{item.label}</span>
              {count != null && count > 0 ? <NavCount count={count} /> : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-border/50 p-3">
        <Link
          to="/ask/$firmSlug"
          params={{ firmSlug }}
          className={cn(
            "text-foreground/80 hover:text-foreground inline-flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium",
            DASHBOARD_MOTION,
            "hover:bg-card/70 active:scale-[0.98]",
          )}
        >
          Open ask page
          <ArrowSquareOut className="ml-auto size-3.5" aria-hidden />
        </Link>
      </div>
    </aside>
  );
}
