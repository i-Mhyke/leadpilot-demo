"use client";

import { useMemo, useState } from "react";
import { CalendarBlank, EnvelopeSimple, FunnelSimple, Phone } from "@phosphor-icons/react";
import type { BookingRequestItem, FirmConversationLead } from "@leadpilot/shared";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { bookingStatusLabel } from "../booking-utils";
import { resolveLeadContact } from "../lead-contact";
import {
  DASHBOARD_MOTION,
  dashboardEnterClass,
  formatDashboardWhen,
  formatRelativeWhen,
  visitorInitials,
} from "../dashboard-utils";
import { ClickableTableRow } from "./clickable-table-row";
import { DashboardEmptyState } from "./dashboard-panel";

type LeadFilter = "all" | "new" | "booking" | "hot";

const FILTERS: { id: LeadFilter; label: string }[] = [
  { id: "all", label: "All leads" },
  { id: "new", label: "New" },
  { id: "booking", label: "Booking requested" },
  { id: "hot", label: "Hot" },
];

type LeadRowData = FirmConversationLead & {
  booking?: BookingRequestItem;
};

function buildLeadRows(leads: FirmConversationLead[], bookings: BookingRequestItem[]): LeadRowData[] {
  const bookingByConversation = new Map(
    bookings.map((booking) => [booking.conversationId, booking] as const),
  );
  const seen = new Set<string>();

  const rows: LeadRowData[] = leads
    .filter((lead) => lead.lead || lead.bookingStatus || bookingByConversation.has(lead.conversationId))
    .map((lead) => {
      seen.add(lead.conversationId);
      return { ...lead, booking: bookingByConversation.get(lead.conversationId) };
    });

  for (const booking of bookings) {
    if (seen.has(booking.conversationId)) continue;
    rows.push({
      conversationId: booking.conversationId,
      visitorId: booking.conversationId,
      visitorLabel: booking.visitorName ?? booking.visitorEmail ?? "Visitor",
      visitorName: booking.visitorName,
      visitorEmail: booking.visitorEmail,
      visitorPhone: booking.visitorPhone,
      companyName: booking.companyName,
      matterSummary: booking.matterSummary,
      preferredBookingAt: booking.preferredBookingAt,
      phase: "qualify",
      status: "open",
      createdAt: booking.createdAt,
      messageCount: 0,
      topics: [],
      bookingStatus: booking.status,
      booking,
    });
  }

  return rows.sort(
    (left, right) =>
      new Date(right.lastMessageAt ?? right.booking?.createdAt ?? right.createdAt).getTime() -
      new Date(left.lastMessageAt ?? left.booking?.createdAt ?? left.createdAt).getTime(),
  );
}

function filterLeadRows(rows: LeadRowData[], filter: LeadFilter) {
  if (filter === "all") return rows;
  if (filter === "new") return rows.filter((row) => row.lead?.status === "new");
  if (filter === "booking") return rows.filter((row) => row.bookingStatus || row.booking);
  return rows.filter((row) => row.lead?.temperature === "hot");
}

function preferredTimeLabel(row: LeadRowData) {
  if (row.booking?.preferredBookingAt || row.preferredBookingAt) {
    return formatDashboardWhen(row.booking?.preferredBookingAt ?? row.preferredBookingAt);
  }
  if (row.booking?.preferredTimeText?.trim()) {
    return row.booking.preferredTimeText.trim();
  }
  return null;
}

function pipelineStatusLabel(row: LeadRowData) {
  if (row.booking) return bookingStatusLabel(row.booking.status);
  if (row.bookingStatus) return bookingStatusLabel(row.bookingStatus);
  if (row.lead) return row.lead.status;
  return "Qualified";
}

function LeadContactCell({ row }: { row: LeadRowData }) {
  const contact = resolveLeadContact(row);

  return (
    <div className="flex min-w-0 items-start gap-3">
      <div
        className="bg-accent text-accent-foreground flex size-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tracking-tight"
        aria-hidden
      >
        {visitorInitials(contact.avatarLabel)}
      </div>
      <div className="min-w-0 space-y-0.5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-foreground truncate text-sm font-semibold">{contact.displayName}</p>
          {!contact.contactCaptured ? (
            <Badge variant="secondary" className="rounded-full text-[10px] font-medium">
              Contact not captured
            </Badge>
          ) : null}
        </div>
        <div className="text-muted-foreground flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
          {contact.email ? (
            <span className="inline-flex min-w-0 items-center gap-1">
              <EnvelopeSimple className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{contact.email}</span>
            </span>
          ) : contact.contactCaptured ? (
            <span>No email yet</span>
          ) : (
            <span className="font-mono">ID {contact.visitorRef}</span>
          )}
          {contact.phone ? (
            <span className="inline-flex items-center gap-1">
              <Phone className="size-3.5 shrink-0" aria-hidden />
              {contact.phone}
            </span>
          ) : contact.contactCaptured ? (
            <span>No phone yet</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function LeadRow({
  firmSlug,
  lead,
  index,
}: {
  firmSlug: string;
  lead: LeadRowData;
  index: number;
}) {
  const matter = lead.matterSummary ?? lead.lead?.summary ?? lead.booking?.matterSummary ?? "Conversation in progress";
  const preferredTime = preferredTimeLabel(lead);
  const isClickable = Boolean(lead.bookingStatus || lead.booking);
  const rowClass = cn(
    "border-border/50 border-b last:border-b-0",
    DASHBOARD_MOTION,
    "hover:bg-muted/25",
    dashboardEnterClass(index + 1),
  );
  const cells = (
    <>
      <td className="px-5 py-4 md:px-7">
        <LeadContactCell row={lead} />
      </td>
      <td className="max-w-[18rem] px-3 py-4">
        <p className="text-foreground line-clamp-2 text-sm leading-relaxed">{matter}</p>
        {lead.companyName ? (
          <p className="text-muted-foreground mt-1 truncate text-xs">{lead.companyName}</p>
        ) : null}
      </td>
      <td className="px-3 py-4">
        <div className="space-y-1">
          <Badge variant="outline" className="rounded-full text-[11px] capitalize">
            {pipelineStatusLabel(lead)}
          </Badge>
          {lead.lead ? (
            <p className="text-muted-foreground text-xs capitalize">
              {lead.lead.temperature} ·{" "}
              <span className="font-mono tabular-nums">{lead.lead.score}</span>
            </p>
          ) : null}
        </div>
      </td>
      <td className="text-muted-foreground hidden px-3 py-4 text-xs lg:table-cell">
        {preferredTime ?? "Not provided"}
      </td>
      <td className="text-muted-foreground px-3 py-4 text-xs whitespace-nowrap">
        <span className="inline-flex items-center gap-1">
          <CalendarBlank className="size-3.5 shrink-0" aria-hidden />
          {formatRelativeWhen(lead.lastMessageAt ?? lead.booking?.createdAt ?? lead.createdAt)}
        </span>
      </td>
    </>
  );

  if (isClickable) {
    return (
      <ClickableTableRow
        to="/dashboard/$firmSlug/leads/$conversationId"
        params={{ firmSlug, conversationId: lead.conversationId }}
        className={rowClass}
      >
        {cells}
      </ClickableTableRow>
    );
  }

  return <tr className={rowClass}>{cells}</tr>;
}

export function LeadsWorkspace({
  firmSlug,
  leads,
  bookings,
}: {
  firmSlug: string;
  leads: FirmConversationLead[];
  bookings: BookingRequestItem[];
}) {
  const [filter, setFilter] = useState<LeadFilter>("all");
  const leadRows = useMemo(() => buildLeadRows(leads, bookings), [bookings, leads]);
  const filteredLeads = useMemo(() => filterLeadRows(leadRows, filter), [filter, leadRows]);
  const counts = useMemo(
    () => ({
      all: leadRows.length,
      new: leadRows.filter((row) => row.lead?.status === "new").length,
      booking: leadRows.filter((row) => row.bookingStatus || row.booking).length,
      hot: leadRows.filter((row) => row.lead?.temperature === "hot").length,
    }),
    [leadRows],
  );

  return (
    <section className="flex flex-col" aria-label="Leads pipeline">
      <div className="border-border/50 flex flex-col gap-4 border-b px-5 py-4 md:flex-row md:items-center md:justify-between md:px-7">
        <div className="flex flex-wrap items-center gap-1">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium",
                DASHBOARD_MOTION,
                "active:scale-[0.98]",
                filter === item.id
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              {item.label}
              <span className="ml-1.5 font-mono text-[11px] tabular-nums opacity-70">
                {counts[item.id]}
              </span>
            </button>
          ))}
        </div>
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <FunnelSimple className="size-3.5" aria-hidden />
          Name and email first; visitor ID only when contact was not captured
        </div>
      </div>

      {filteredLeads.length === 0 ? (
        <div className="p-5 md:p-7">
          <DashboardEmptyState
            title="No leads in this view"
            description="Qualified visitors appear here after scoring, contact capture, or a booking request."
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <thead>
              <tr className="border-border/60 text-muted-foreground border-b text-left text-[11px] font-medium tracking-[0.04em] uppercase">
                <th className="px-5 py-3 font-medium md:px-7">Contact</th>
                <th className="px-3 py-3 font-medium">Matter</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="hidden px-3 py-3 font-medium lg:table-cell">Preferred time</th>
                <th className="px-3 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead, index) => (
                <LeadRow
                  key={lead.conversationId}
                  firmSlug={firmSlug}
                  lead={lead}
                  index={index}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
