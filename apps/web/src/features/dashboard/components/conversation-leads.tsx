import { ChatCircle, LinkSimple } from "@phosphor-icons/react";
import type { FirmConversationLead } from "@leadpilot/shared";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  DASHBOARD_MOTION,
  dashboardEnterClass,
  formatRelativeWhen,
  topicPillTone,
  visitorInitials,
} from "../dashboard-utils";
import { ClickableTableRow } from "./clickable-table-row";
import { DashboardEmptyState } from "./dashboard-panel";

function phaseLabel(phase: FirmConversationLead["phase"]) {
  return phase.charAt(0).toUpperCase() + phase.slice(1);
}

function TopicPill({ topic }: { topic: string }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-[8rem] truncate rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        topicPillTone(topic),
      )}
      title={topic}
    >
      {topic}
    </span>
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
      <div className="p-5 md:p-7">
        <DashboardEmptyState
          title="No visitor conversations yet"
          description="Chats from the ask page will appear here with matter summaries and thread context."
        />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[52rem] border-collapse text-sm">
        <thead>
          <tr className="border-border/60 text-muted-foreground border-b text-left text-[11px] font-medium tracking-[0.04em] uppercase">
            <th className="px-5 py-3 font-medium md:px-7">Visitor</th>
            <th className="px-3 py-3 font-medium">Matter</th>
            <th className="hidden px-3 py-3 font-medium md:table-cell">Phase</th>
            <th className="hidden px-3 py-3 font-medium lg:table-cell">Topics</th>
            <th className="px-3 py-3 font-medium">Messages</th>
            <th className="px-3 py-3 font-medium">Last active</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead, index) => {
            const matter = lead.matterSummary ?? lead.lead?.summary ?? "Conversation in progress";
            const rowClass = cn(
              "border-border/50 border-b last:border-b-0",
              DASHBOARD_MOTION,
              "hover:bg-muted/25",
              dashboardEnterClass(index + 1),
            );
            const cells = (
              <>
                <td className="px-5 py-3.5 md:px-7">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar size="sm" className="size-8">
                      <AvatarFallback className="bg-muted text-foreground text-[10px] font-semibold">
                        {visitorInitials(lead.visitorLabel)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-foreground truncate text-sm font-medium">{lead.visitorLabel}</p>
                      <p className="text-muted-foreground truncate text-xs capitalize">{lead.status}</p>
                    </div>
                  </div>
                </td>
                <td className="max-w-[18rem] px-3 py-3.5">
                  <p className="text-foreground line-clamp-2 text-sm leading-snug">{matter}</p>
                  {lead.bookingStatus ? (
                    <span className="text-primary mt-1 inline-flex items-center gap-1 text-xs font-medium">
                      <LinkSimple className="size-3" aria-hidden />
                      Booking linked
                    </span>
                  ) : null}
                </td>
                <td className="hidden px-3 py-3.5 md:table-cell">
                  <Badge variant="secondary" className="rounded-full text-[11px] font-normal">
                    {phaseLabel(lead.phase)}
                  </Badge>
                </td>
                <td className="hidden px-3 py-3.5 lg:table-cell">
                  {lead.topics.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {lead.topics.slice(0, 2).map((topic) => (
                        <TopicPill key={topic} topic={topic} />
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </td>
                <td className="px-3 py-3.5">
                  <span className="text-foreground inline-flex items-center gap-1.5 font-mono text-xs tabular-nums">
                    <ChatCircle className="text-muted-foreground size-3.5" aria-hidden />
                    {lead.messageCount}
                  </span>
                </td>
                <td className="text-muted-foreground px-3 py-3.5 text-xs whitespace-nowrap">
                  {formatRelativeWhen(lead.lastMessageAt ?? lead.createdAt)}
                </td>
              </>
            );

            if (lead.bookingStatus) {
              return (
                <ClickableTableRow
                  key={lead.conversationId}
                  to="/dashboard/$firmSlug/leads/$conversationId"
                  params={{ firmSlug, conversationId: lead.conversationId }}
                  className={rowClass}
                >
                  {cells}
                </ClickableTableRow>
              );
            }

            return (
              <tr key={lead.conversationId} className={rowClass}>
                {cells}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
