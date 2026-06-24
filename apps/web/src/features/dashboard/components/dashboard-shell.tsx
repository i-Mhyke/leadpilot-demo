import type { ReactNode } from "react";
import type { FirmDashboardOverview } from "@leadpilot/shared";
import { DashboardSidebar } from "./dashboard-sidebar";

export function DashboardShell({
  firmSlug,
  overview,
  children,
}: {
  firmSlug: string;
  overview: FirmDashboardOverview;
  children: ReactNode;
}) {
  return (
    <main className="bg-background min-h-dvh w-full">
      <div className="flex min-h-dvh w-full flex-col bg-card lg:flex-row">
        <DashboardSidebar firmSlug={firmSlug} overview={overview} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-border/60 lg:border-l">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
        </div>
      </div>
    </main>
  );
}
