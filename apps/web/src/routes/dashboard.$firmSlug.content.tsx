import { getFirmContentRecommendations } from "@/features/dashboard/content-intelligence-actions";
import { ContentRecommendations } from "@/features/dashboard/components/content-recommendations";
import { DashboardPageHeader } from "@/features/dashboard/components/dashboard-page-header";
import { INSIGHT_DEFAULT_RANGE_DAYS, resolveInsightDateRange } from "@leadpilot/shared";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/$firmSlug/content")({
  loader: async ({ params }) => {
    const range = resolveInsightDateRange({});
    const recommendationsResult = await getFirmContentRecommendations({
      data: {
        firmSlug: params.firmSlug,
        from: range.ok ? range.from : undefined,
        to: range.ok ? range.to : undefined,
      },
    });

    return {
      firmSlug: params.firmSlug,
      recommendationsResult,
      defaultRangeDays: INSIGHT_DEFAULT_RANGE_DAYS,
      initialFrom: range.ok ? range.from : undefined,
      initialTo: range.ok ? range.to : undefined,
    };
  },
  component: DashboardContentPage,
});

function DashboardContentPage() {
  const { firmSlug, recommendationsResult, defaultRangeDays, initialFrom, initialTo } =
    Route.useLoaderData();

  const recommendations =
    recommendationsResult.kind === "ok" ? recommendationsResult.recommendations : [];

  return (
    <>
      <DashboardPageHeader
        eyebrow="Intelligence"
        title="Content"
        description="Draft recommendations derived from conversation topics in a selected date range. Video ideas are briefs only."
      />
      <ContentRecommendations
        firmSlug={firmSlug}
        initialRecommendations={recommendations}
        initialFrom={initialFrom}
        initialTo={initialTo}
        defaultRangeDays={defaultRangeDays}
      />
    </>
  );
}
