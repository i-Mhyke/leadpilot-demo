import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/$firmSlug/leads")({
  component: DashboardLeadsLayout,
});

function DashboardLeadsLayout() {
  return <Outlet />;
}
