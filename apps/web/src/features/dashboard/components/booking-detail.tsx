import type { ReactNode, ComponentType } from "react";
import {
  ArrowLeft,
  CalendarBlank,
  EnvelopeSimple,
  Globe,
  Phone,
  Thermometer,
  User,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import type { FirmBookingDetail } from "@leadpilot/shared";
import { CONVERSATION_CONTEXT_PREVIEW_LIMIT } from "@leadpilot/shared";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { bookingContactLabel, bookingStatusLabel } from "../booking-utils";
import { DASHBOARD_MOTION, formatDashboardWhen, visitorInitials } from "../dashboard-utils";
import { ConversationContextPanel } from "./conversation-context-panel";
import { DashboardPanel } from "./dashboard-panel";

export function BookingDetail({
  firmSlug,
  detail,
}: {
  firmSlug: string;
  detail: FirmBookingDetail;
}) {
  const { booking, lead } = detail;
  const label = bookingContactLabel(booking);

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <Link
        to="/dashboard/$firmSlug/leads"
        params={{ firmSlug }}
        className={cn(
          "text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium",
          DASHBOARD_MOTION,
          "focus-visible:ring-primary/20 rounded-md outline-none focus-visible:ring-2",
        )}
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to leads
      </Link>

      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className="bg-accent text-accent-foreground flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
            aria-hidden
          >
            {visitorInitials(label)}
          </div>
          <div className="min-w-0">
            <h2 className="text-foreground truncate text-base font-semibold tracking-tight">{label}</h2>
            {booking.companyName ? (
              <p className="text-muted-foreground truncate text-sm">{booking.companyName}</p>
            ) : null}
          </div>
        </div>
        <Badge variant="outline" className="w-fit rounded-full text-[11px]">
          {bookingStatusLabel(booking.status)}
        </Badge>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[1.35fr_0.85fr]">
        <ConversationContextPanel
          messages={detail.messages}
          messageCount={detail.messageCount}
          previewLimit={CONVERSATION_CONTEXT_PREVIEW_LIMIT}
        />

        <div className="space-y-4">
          <DashboardPanel innerClassName="divide-border/60 divide-y">
            <DetailSection title="Contact">
              <DetailRow icon={User} label="Name" value={booking.visitorName ?? "Not provided"} />
              <DetailRow icon={EnvelopeSimple} label="Email" value={booking.visitorEmail ?? "No email yet"} />
              <DetailRow icon={Phone} label="Phone" value={booking.visitorPhone ?? "No phone yet"} />
            </DetailSection>

            <DetailSection title="Request">
              <DetailRow
                icon={CalendarBlank}
                label="Received"
                value={formatDashboardWhen(booking.createdAt)}
              />
              <DetailRow
                icon={CalendarBlank}
                label="Structured booking time"
                value={
                  booking.preferredBookingAt
                    ? formatDashboardWhen(booking.preferredBookingAt)
                    : booking.preferredTimeText?.trim() ?? "Preferred time not provided"
                }
              />
              {booking.urgency ? (
                <DetailRow icon={CalendarBlank} label="Urgency" value={booking.urgency} />
              ) : null}
            </DetailSection>

            {lead ? (
              <DetailSection title="Qualification">
                <div className="space-y-2 px-4 py-3 md:px-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="rounded-full text-[11px] uppercase">
                      {lead.status}
                    </Badge>
                    <p className="text-muted-foreground flex items-center gap-1 text-xs font-medium">
                      <Thermometer className="size-3.5" aria-hidden />
                      {lead.temperature} ·{" "}
                      <span className="text-foreground font-mono tabular-nums">{lead.score}</span>
                    </p>
                  </div>
                  {lead.summary ? (
                    <p className="text-foreground text-sm leading-relaxed">{lead.summary}</p>
                  ) : null}
                </div>
              </DetailSection>
            ) : null}

            <DetailSection title="Matter">
              <div className="space-y-3 px-4 py-3 md:px-5">
                <div>
                  <p className="text-foreground text-[11px] font-medium tracking-wide uppercase">
                    Summary
                  </p>
                  <p className="text-foreground mt-1 text-sm leading-relaxed">{booking.matterSummary}</p>
                </div>
                <div>
                  <p className="text-foreground text-[11px] font-medium tracking-wide uppercase">
                    Lead brief
                  </p>
                  <p className="text-foreground mt-1 text-sm leading-relaxed">{booking.leadBrief}</p>
                </div>
              </div>
            </DetailSection>

            {booking.sourceUrl ? (
              <DetailSection title="Source">
                <div className="px-4 py-3 md:px-5">
                  <p className="text-muted-foreground flex items-start gap-1.5 text-sm">
                    <Globe className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    <span className="break-all">{booking.sourceUrl}</span>
                  </p>
                </div>
              </DetailSection>
            ) : null}
          </DashboardPanel>
        </div>
      </div>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground px-4 pt-3 text-[11px] font-medium tracking-[0.12em] uppercase md:px-5">
        {title}
      </p>
      {children}
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2 px-4 py-2 md:px-5">
      <Icon className="text-muted-foreground mt-0.5 size-3.5 shrink-0" aria-hidden />
      <div className="min-w-0">
        <dt className="text-muted-foreground text-xs">{label}</dt>
        <dd className="text-foreground mt-0.5 text-sm break-words">{value}</dd>
      </div>
    </div>
  );
}
