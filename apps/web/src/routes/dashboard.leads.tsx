import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/leads")({
  beforeLoad: () => {
    throw redirect({
      to: "/dashboard/$firmSlug/leads",
      params: { firmSlug: "demo-law" },
    });
  },
});
