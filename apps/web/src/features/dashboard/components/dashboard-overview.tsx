import { ChatsCircle, UsersThree } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import type { FirmDashboardOverview } from "@leadpilot/shared";
import { dashboardEnterClass, formatDashboardWhen } from "../dashboard-utils";
import { DashboardEmptyState, DashboardListPanel } from "./dashboard-panel";
import { MetricTile } from "./metric-tile";

export function DashboardOverview({
  overview,
  firmSlug,
}: {
  overview: FirmDashboardOverview;
  firmSlug: string;
}) {
  const hasActivity =
    overview.metrics.conversationsTotal > 0 ||
    overview.metrics.newLeads > 0 ||
    overview.metrics.bookingRequests > 0;

  return (
    <section className="flex flex-col gap-6 p-4 md:p-6" aria-label="Firm dashboard overview">
      <div className={`grid gap-3 lg:grid-cols-[1.35fr_0.85fr] ${dashboardEnterClass(1)}`}>
        <MetricTile
          label="Conversations"
          value={overview.metrics.conversationsTotal}
          hint={`${overview.metrics.conversationsToday} started today`}
          variant="featured"
        />
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <MetricTile
            label="New leads"
            value={overview.metrics.newLeads}
            hint="Status: new"
            variant="compact"
          />
          <MetricTile
            label="Booking requests"
            value={overview.metrics.bookingRequests}
            hint="Requested, not confirmed"
            variant="compact"
          />
          <MetricTile
            label="Tracked topics"
            value={overview.metrics.recentTopics.length}
            hint="Recurring visitor themes"
            variant="compact"
          />
        </div>
      </div>

      <div className={`grid gap-6 lg:grid-cols-[1.35fr_0.85fr] ${dashboardEnterClass(2)}`}>
        <section aria-label="Recent conversations">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ChatsCircle className="text-primary size-4" weight="duotone" aria-hidden />
              <h3 className="text-foreground text-sm font-semibold tracking-tight">
                Recent conversations
              </h3>
            </div>
            {overview.recentConversations.length > 0 ? (
              <Link
                to="/dashboard/$firmSlug/conversations"
                params={{ firmSlug }}
                className="text-primary text-xs font-medium transition-colors hover:text-primary/80"
              >
                View all
              </Link>
            ) : null}
          </div>
          {!hasActivity || overview.recentConversations.length === 0 ? (
            <DashboardEmptyState
              title="No conversations yet"
              description="Visitor chats on the ask page will appear here after persistence."
            />
          ) : (
            <DashboardListPanel>
              {overview.recentConversations.map((conversation) => (
                <div key={conversation.id} className="px-4 py-3.5 md:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-foreground text-sm font-medium">
                        {conversation.matterSummary ?? "Conversation in progress"}
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-xs capitalize">
                        {conversation.phase} · {conversation.status}
                      </p>
                    </div>
                    <p className="text-muted-foreground font-mono text-xs tabular-nums">
                      {formatDashboardWhen(conversation.lastMessageAt ?? conversation.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </DashboardListPanel>
          )}
        </section>

        <section aria-label="Topic trends">
          <div className="mb-3 flex items-center gap-2">
            <UsersThree className="text-primary size-4" weight="duotone" aria-hidden />
            <h3 className="text-foreground text-sm font-semibold tracking-tight">Topic trends</h3>
          </div>
          {overview.metrics.recentTopics.length === 0 ? (
            <DashboardEmptyState
              title="No topics tracked"
              description="Topics will appear after the conversation analyst records visitor themes."
            />
          ) : (
            <DashboardListPanel>
              {overview.metrics.recentTopics.map((topic) => (
                <div
                  key={topic.topic}
                  className="flex items-center justify-between gap-3 px-4 py-3.5 text-sm md:px-5"
                >
                  <span className="text-foreground line-clamp-2">{topic.topic}</span>
                  <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
                    {topic.count}
                  </span>
                </div>
              ))}
            </DashboardListPanel>
          )}
        </section>
      </div>
    </section>
  );
}
