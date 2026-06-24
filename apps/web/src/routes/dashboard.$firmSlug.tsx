import { getFirmDashboardOverview } from "@/features/dashboard/server";
import { DashboardShell } from "@/features/dashboard/components/dashboard-shell";
import { DashboardState } from "@/features/dashboard/components/dashboard-state";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/$firmSlug")({
  loader: async ({ params }) => {
    const overviewResult = await getFirmDashboardOverview({ data: { firmSlug: params.firmSlug } });
    return {
      firmSlug: params.firmSlug,
      overviewResult,
    };
  },
  component: FirmDashboardLayout,
});

function FirmDashboardLayout() {
  const { firmSlug, overviewResult } = Route.useLoaderData();

  if (overviewResult.kind === "not_found") {
    return (
      <main className="bg-background min-h-[100dvh] px-4 py-10">
        <DashboardState
          title="Firm not found"
          description={`No active dashboard is available for "${firmSlug}".`}
        />
      </main>
    );
  }

  if (overviewResult.kind === "inactive") {
    return (
      <main className="bg-background min-h-[100dvh] px-4 py-10">
        <DashboardState
          title="Firm inactive"
          description="This firm dashboard is inactive and cannot load operational data."
        />
      </main>
    );
  }

  return (
    <DashboardShell firmSlug={firmSlug} overview={overviewResult.overview}>
      <Outlet />
    </DashboardShell>
  );
}
