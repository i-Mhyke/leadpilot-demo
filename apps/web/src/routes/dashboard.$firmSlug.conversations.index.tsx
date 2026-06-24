import { getFirmConversationLeads } from "@/features/dashboard/server";
import { ConversationLeads } from "@/features/dashboard/components/conversation-leads";
import { DashboardPageHeader } from "@/features/dashboard/components/dashboard-page-header";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/$firmSlug/conversations/")({
  loader: async ({ params }) => {
    const leadsResult = await getFirmConversationLeads({ data: { firmSlug: params.firmSlug } });
    return { leadsResult, firmSlug: params.firmSlug };
  },
  component: DashboardConversationsPage,
});

function DashboardConversationsPage() {
  const { leadsResult, firmSlug } = Route.useLoaderData();

  if (leadsResult.kind !== "ok") return null;

  return (
    <>
      <DashboardPageHeader
        eyebrow="Threads"
        title="Conversations"
        description="Every visitor chat from the ask page — matter context, phase, and message volume without lead scoring noise."
      />
      <ConversationLeads firmSlug={firmSlug} leads={leadsResult.leads} />
    </>
  );
}
