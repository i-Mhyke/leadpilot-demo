import { getFirmBookingRequests, getFirmConversationLeads } from "@/features/dashboard/server";
import { BookingRequests } from "@/features/dashboard/components/booking-requests";
import { ConversationLeads } from "@/features/dashboard/components/conversation-leads";
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
        description="Visitor conversations with matter summaries, qualification signals, and booking context from persisted records."
      />
      <div className="space-y-8 pb-4">
        <BookingRequests firmSlug={firmSlug} bookings={bookingsResult.bookings} />
        <section>
          <div className="px-4 pb-3 md:px-6 lg:px-8">
            <h3 className="text-foreground text-sm font-semibold tracking-tight">All conversations</h3>
            <p className="text-muted-foreground mt-0.5 text-sm">
              Every visitor thread, including unscored chats and conversations without a booking
              request.
            </p>
          </div>
          <ConversationLeads firmSlug={firmSlug} leads={leadsResult.leads} />
        </section>
      </div>
    </>
  );
}
