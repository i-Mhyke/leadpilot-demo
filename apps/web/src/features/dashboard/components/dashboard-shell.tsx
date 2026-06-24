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
    <main className="bg-[#f4f5f7] min-h-dvh w-full">
      <div className="flex min-h-dvh w-full flex-col lg:flex-row">
        <DashboardSidebar firmSlug={firmSlug} overview={overview} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3 md:p-4 lg:p-5">
            <div className="border-border/50 bg-card min-h-[calc(100dvh-1.5rem)] flex-1 overflow-hidden rounded-2xl border shadow-[0_20px_40px_-24px_rgba(28,35,41,0.18)] lg:min-h-[calc(100dvh-2.5rem)]">
              {children}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
