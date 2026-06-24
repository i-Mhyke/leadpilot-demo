import { CalendarBlank, CaretRight, EnvelopeSimple, Phone } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import type { BookingRequestItem } from "@leadpilot/shared";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { bookingContactLabel, bookingStatusLabel } from "../booking-utils";
import {
  DASHBOARD_MOTION,
  dashboardEnterClass,
  formatDashboardWhen,
  visitorInitials,
} from "../dashboard-utils";
import { DashboardEmptyState, DashboardListPanel, DashboardPanel } from "./dashboard-panel";

export function BookingRequests({
  firmSlug,
  bookings,
}: {
  firmSlug: string;
  bookings: BookingRequestItem[];
}) {
  return (
    <section className="space-y-3">
      <div className="px-4 md:px-6 lg:px-8">
        <h3 className="text-foreground text-sm font-semibold tracking-tight">Booking requests</h3>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Intake requests from qualified conversations. Open a row to review contact details and
          context.
        </p>
      </div>

      {bookings.length === 0 ? (
        <div className="px-4 md:px-6 lg:px-8">
          <DashboardEmptyState
            title="No booking requests yet"
            description="When a visitor requests a consultation, it will appear here for firm review."
          />
        </div>
      ) : (
        <div className="px-4 md:px-6 lg:px-8">
          <DashboardListPanel>
            {bookings.map((booking, index) => (
              <BookingRequestRow
                key={booking.id}
                firmSlug={firmSlug}
                booking={booking}
                index={index}
              />
            ))}
          </DashboardListPanel>
        </div>
      )}
    </section>
  );
}

function BookingRequestRow({
  firmSlug,
  booking,
  index,
}: {
  firmSlug: string;
  booking: BookingRequestItem;
  index: number;
}) {
  const label = bookingContactLabel(booking);

  return (
    <Link
      to="/dashboard/$firmSlug/leads/$conversationId"
      params={{ firmSlug, conversationId: booking.conversationId }}
      className={cn(
        "group flex min-w-0 items-start gap-3 px-4 py-4 outline-none md:px-5 md:py-5",
        DASHBOARD_MOTION,
        "hover:bg-muted/20 focus-visible:bg-muted/25 focus-visible:ring-primary/20 active:scale-[0.998]",
        dashboardEnterClass(index + 1),
      )}
    >
      <div
        className="bg-accent text-accent-foreground flex size-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tracking-tight"
        aria-hidden
      >
        {visitorInitials(label)}
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <p className="text-foreground truncate text-sm font-semibold">{label}</p>
            <div className="text-muted-foreground flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
              {booking.visitorEmail ? (
                <span className="inline-flex min-w-0 items-center gap-1">
                  <EnvelopeSimple className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{booking.visitorEmail}</span>
                </span>
              ) : (
                <span>No email yet</span>
              )}
              {booking.visitorPhone ? (
                <span className="inline-flex items-center gap-1">
                  <Phone className="size-3.5 shrink-0" aria-hidden />
                  {booking.visitorPhone}
                </span>
              ) : (
                <span>No phone yet</span>
              )}
            </div>
          </div>
          <Badge variant="outline" className="shrink-0 rounded-full text-[11px]">
            {bookingStatusLabel(booking.status)}
          </Badge>
        </div>

        <p className="text-foreground line-clamp-2 text-sm leading-relaxed">{booking.matterSummary}</p>

        <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-1">
            <CalendarBlank className="size-3.5 shrink-0" aria-hidden />
            Received {formatDashboardWhen(booking.createdAt)}
          </span>
          <span>
            {booking.preferredTimeText?.trim()
              ? `Preferred: ${booking.preferredTimeText}`
              : "Preferred time not provided"}
          </span>
        </div>
      </div>

      <CaretRight
        className="text-muted-foreground mt-2 size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        aria-hidden
      />
    </Link>
  );
}
