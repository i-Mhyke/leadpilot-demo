import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: ({ location }) => {
    if (location.pathname === "/dashboard" || location.pathname === "/dashboard/") {
      throw redirect({
        to: "/dashboard/$firmSlug",
        params: { firmSlug: "demo-law" },
      });
    }
  },
  component: DashboardLayout,
});

function DashboardLayout() {
  return <Outlet />;
}
