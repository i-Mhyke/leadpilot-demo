import { getRouteApi } from "@tanstack/react-router";
import { DashboardOverview } from "@/features/dashboard/components/dashboard-overview";
import { DashboardPageHeader } from "@/features/dashboard/components/dashboard-page-header";
import { createFileRoute } from "@tanstack/react-router";

const parentRoute = getRouteApi("/dashboard/$firmSlug");

export const Route = createFileRoute("/dashboard/$firmSlug/")({
  component: DashboardIndexPage,
});

function DashboardIndexPage() {
  const { firmSlug, overviewResult } = parentRoute.useLoaderData();

  if (overviewResult.kind !== "ok") return null;

  return (
    <>
      <DashboardPageHeader
        eyebrow="Operations"
        title="Overview"
        description="Firm activity at a glance — conversations, leads, booking requests, and topic trends."
      />
      <DashboardOverview overview={overviewResult.overview} firmSlug={firmSlug} />
    </>
  );
}
