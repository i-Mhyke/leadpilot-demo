import { CalendarBlank, Globe, Thermometer } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import type { FirmConversationLead } from "@leadpilot/shared";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  DASHBOARD_MOTION,
  dashboardEnterClass,
  formatDashboardWhen,
  visitorInitials,
} from "../dashboard-utils";
import { DashboardEmptyState, DashboardListPanel } from "./dashboard-panel";

function phaseLabel(phase: FirmConversationLead["phase"]) {
  return phase.charAt(0).toUpperCase() + phase.slice(1);
}

function temperatureTone(temperature: "cold" | "warm" | "hot") {
  if (temperature === "hot") return "text-foreground";
  if (temperature === "warm") return "text-muted-foreground";
  return "text-muted-foreground/80";
}

function LeadTopicBadge({ topic }: { topic: string }) {
  return (
    <Badge
      variant="secondary"
      className="max-w-full shrink overflow-hidden rounded-full text-[11px] font-normal"
      title={topic}
    >
      <span className="block truncate">{topic}</span>
    </Badge>
  );
}

export function ConversationLeads({
  firmSlug,
  leads,
}: {
  firmSlug: string;
  leads: FirmConversationLead[];
}) {
  if (leads.length === 0) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <DashboardEmptyState
          title="No visitor conversations yet"
          description="Chats from the ask page will appear here with matter summaries and qualification context."
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <DashboardListPanel>
        {leads.map((lead, index) => {
          const rowClassName = cn(
            "min-w-0 overflow-hidden px-4 py-4 md:px-5 md:py-5",
            DASHBOARD_MOTION,
            "hover:bg-muted/20",
            dashboardEnterClass(index + 1),
            lead.bookingStatus
              ? "focus-visible:ring-primary/20 block outline-none focus-visible:ring-2"
              : undefined,
          );
          const content = (
            <div className="flex min-w-0 flex-col gap-4">
              <div className="flex min-w-0 items-start justify-between gap-4">
                <div className="flex min-w-0 flex-1 gap-3">
                  <div
                    className="bg-accent text-accent-foreground flex size-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tracking-tight"
                    aria-hidden
                  >
                    {visitorInitials(lead.visitorLabel)}
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <p className="text-foreground truncate text-sm font-semibold">
                        {lead.visitorLabel}
                      </p>
                      {lead.companyName ? (
                        <span className="text-muted-foreground truncate text-xs">
                          {lead.companyName}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                  {lead.lead ? (
                    <>
                      <Badge variant="outline" className="rounded-full text-[11px] uppercase">
                        {lead.lead.status}
                      </Badge>
                      <p
                        className={cn(
                          "flex items-center gap-1 text-xs font-medium whitespace-nowrap",
                          temperatureTone(lead.lead.temperature),
                        )}
                      >
                        <Thermometer className="size-3.5" aria-hidden />
                        {lead.lead.temperature} ·{" "}
                        <span className="font-mono tabular-nums">{lead.lead.score}</span>
                      </p>
                    </>
                  ) : (
                    <Badge variant="secondary" className="rounded-full text-[11px]">
                      Unscored
                    </Badge>
                  )}
                  {lead.bookingStatus === "requested" ? (
                    <Badge variant="outline" className="rounded-full text-[11px]">
                      Booking requested
                    </Badge>
                  ) : null}
                </div>
              </div>

              <p className="text-foreground line-clamp-3 text-sm leading-relaxed">
                {lead.matterSummary ?? lead.lead?.summary ?? "Conversation in progress"}
              </p>

              {lead.topics.length > 0 ? (
                <div className="flex min-w-0 flex-wrap gap-1.5">
                  {lead.topics.slice(0, 4).map((topic) => (
                    <LeadTopicBadge key={topic} topic={topic} />
                  ))}
                </div>
              ) : null}

              <dl className="border-border/60 text-muted-foreground grid min-w-0 gap-x-6 gap-y-2 border-t pt-3 text-xs sm:grid-cols-2 xl:grid-cols-4">
                <div className="min-w-0">
                  <dt className="text-foreground font-medium">Phase</dt>
                  <dd className="mt-0.5">{phaseLabel(lead.phase)}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-foreground font-medium">Status</dt>
                  <dd className="mt-0.5 capitalize">{lead.status}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-foreground flex items-center gap-1 font-medium">
                    <CalendarBlank className="size-3.5 shrink-0" aria-hidden />
                    Last activity
                  </dt>
                  <dd className="mt-0.5">
                    {formatDashboardWhen(lead.lastMessageAt ?? lead.createdAt)}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-foreground font-medium">Messages</dt>
                  <dd className="mt-0.5">
                    <span className="font-mono tabular-nums">{lead.messageCount}</span>
                  </dd>
                </div>
                {lead.sourceUrl ? (
                  <div className="min-w-0 sm:col-span-2 xl:col-span-4">
                    <dt className="text-foreground flex items-center gap-1 font-medium">
                      <Globe className="size-3.5 shrink-0" aria-hidden />
                      Source
                    </dt>
                    <dd className="mt-0.5 truncate" title={lead.sourceUrl}>
                      {lead.sourceUrl}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>
          );

          if (lead.bookingStatus) {
            return (
              <Link
                key={lead.conversationId}
                to="/dashboard/$firmSlug/leads/$conversationId"
                params={{ firmSlug, conversationId: lead.conversationId }}
                className={rowClassName}
              >
                {content}
              </Link>
            );
          }

          return (
            <article key={lead.conversationId} className={rowClassName}>
              {content}
            </article>
          );
        })}
      </DashboardListPanel>
    </div>
  );
}
