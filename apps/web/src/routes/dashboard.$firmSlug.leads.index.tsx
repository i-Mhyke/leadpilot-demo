import { getFirmBookingRequests, getFirmConversationLeads } from "@/features/dashboard/server";
import { LeadsWorkspace } from "@/features/dashboard/components/leads-workspace";
import { DashboardPageHeader } from "@/features/dashboard/components/dashboard-page-header";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/$firmSlug/leads/")({
  loader: async ({ params }) => {
    const [leadsResult, bookingsResult] = await Promise.all([
      getFirmConversationLeads({ data: { firmSlug: params.firmSlug } }),
      getFirmBookingRequests({ data: { firmSlug: params.firmSlug } }),
    ]);
    return { leadsResult, bookingsResult, firmSlug: params.firmSlug };
  },
  component: DashboardLeadsPage,
});

function DashboardLeadsPage() {
  const { leadsResult, bookingsResult, firmSlug } = Route.useLoaderData();

  if (leadsResult.kind !== "ok" || bookingsResult.kind !== "ok") return null;

  return (
    <>
      <DashboardPageHeader
        eyebrow="Pipeline"
        title="Leads"
        description="Qualified visitors with contact signals, scoring, and booking intake — separate from raw chat threads."
      />
      <LeadsWorkspace
        firmSlug={firmSlug}
        leads={leadsResult.leads}
        bookings={bookingsResult.bookings}
      />
    </>
  );
}
