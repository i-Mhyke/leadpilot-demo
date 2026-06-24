import { getFirmBookingDetail } from "@/features/dashboard/server";
import { BookingDetail } from "@/features/dashboard/components/booking-detail";
import { DashboardPageHeader } from "@/features/dashboard/components/dashboard-page-header";
import { DashboardState } from "@/features/dashboard/components/dashboard-state";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/$firmSlug/leads/$conversationId")({
  loader: async ({ params }) => {
    const detailResult = await getFirmBookingDetail({
      data: { firmSlug: params.firmSlug, conversationId: params.conversationId },
    });
    return { detailResult, firmSlug: params.firmSlug };
  },
  component: DashboardBookingDetailPage,
});

function DashboardBookingDetailPage() {
  const { detailResult, firmSlug } = Route.useLoaderData();

  if (detailResult.kind === "not_found" || detailResult.kind === "inactive") {
    return null;
  }

  if (detailResult.kind === "not_found_booking") {
    return (
      <>
        <DashboardPageHeader eyebrow="Booking" title="Request not found" />
        <div className="p-4 md:p-6 lg:p-8">
          <DashboardState
            title="No booking request for this conversation"
            description="This conversation does not have a persisted booking request for your firm."
          >
            <Link
              to="/dashboard/$firmSlug/leads"
              params={{ firmSlug }}
              className="text-primary mt-4 inline-block text-sm font-medium hover:underline"
            >
              Return to leads
            </Link>
          </DashboardState>
        </div>
      </>
    );
  }

  return (
    <>
      <DashboardPageHeader
        eyebrow="Booking"
        title="Request details"
        description="Review contact information, intake brief, and recent conversation context."
      />
      <BookingDetail firmSlug={firmSlug} detail={detailResult.detail} />
    </>
  );
}
