import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/$firmSlug/conversations")({
  component: DashboardConversationsLayout,
});

function DashboardConversationsLayout() {
  return <Outlet />;
}
