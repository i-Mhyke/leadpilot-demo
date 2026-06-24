import { CalendarBlank, ChartBar, Play } from "@phosphor-icons/react";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getFirmContentRecommendations,
  runContentInsightAnalysis,
} from "@/features/dashboard/content-intelligence-actions";
import type { ContentInsightActionResult, FirmContentRecommendation } from "@leadpilot/shared";
import { resolveInsightDateRange } from "@leadpilot/shared";
import { cn } from "@/lib/utils";
import { DASHBOARD_MOTION } from "../dashboard-utils";
import { DashboardEmptyState, DashboardListPanel } from "./dashboard-panel";

const FORMAT_LABELS: Record<FirmContentRecommendation["format"], string> = {
  blog_post: "Blog post",
  linkedin_post: "LinkedIn post",
  email_sequence: "Email sequence",
  video_brief: "Video brief",
  report: "Report",
};

const RANGE_PRESETS = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
] as const;

function formatLabel(format: FirmContentRecommendation["format"]) {
  return FORMAT_LABELS[format];
}

function formatRangeLabel(from: string, to: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${formatter.format(new Date(from))} – ${formatter.format(new Date(to))}`;
}

function resultMessage(result: ContentInsightActionResult | null) {
  if (!result) return null;
  switch (result.kind) {
    case "completed":
    case "failed":
    case "empty":
    case "not_enough_data":
    case "validation_error":
      return result.message;
    default:
      return null;
  }
}

function resultTone(result: ContentInsightActionResult | null) {
  if (!result) return "text-muted-foreground";
  if (result.kind === "validation_error") return "text-foreground";
  return "text-muted-foreground";
}

function groupByFormat(recommendations: FirmContentRecommendation[]) {
  const groups = new Map<FirmContentRecommendation["format"], FirmContentRecommendation[]>();
  for (const rec of recommendations) {
    const existing = groups.get(rec.format) ?? [];
    existing.push(rec);
    groups.set(rec.format, existing);
  }
  return groups;
}

function resolvePresetRange(days: number) {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return resolveInsightDateRange({
    from: from.toISOString(),
    to: to.toISOString(),
  });
}

export function ContentRecommendations({
  firmSlug,
  initialRecommendations,
  initialFrom,
  initialTo,
  defaultRangeDays,
}: {
  firmSlug: string;
  initialRecommendations: FirmContentRecommendation[];
  initialFrom?: string;
  initialTo?: string;
  defaultRangeDays: number;
}) {
  const [selectedDays, setSelectedDays] = useState<number>(defaultRangeDays);
  const [range, setRange] = useState(() => {
    if (initialFrom && initialTo) {
      return { from: initialFrom, to: initialTo };
    }
    const resolved = resolvePresetRange(defaultRangeDays);
    if (!resolved.ok) {
      return { from: new Date().toISOString(), to: new Date().toISOString() };
    }
    return { from: resolved.from, to: resolved.to };
  });
  const [recommendations, setRecommendations] = useState(initialRecommendations);
  const [isRunning, setIsRunning] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [runResult, setRunResult] = useState<ContentInsightActionResult | null>(null);

  const runAnalysis = useServerFn(runContentInsightAnalysis);
  const refreshRecommendations = useServerFn(getFirmContentRecommendations);

  const rangeLabel = useMemo(
    () => formatRangeLabel(range.from, range.to),
    [range.from, range.to],
  );

  async function loadRecommendationsForRange(from: string, to: string) {
    setIsRefreshing(true);
    try {
      const refreshed = await refreshRecommendations({
        data: { firmSlug, from, to },
      });
      if (refreshed.kind === "ok") {
        setRecommendations(refreshed.recommendations);
      }
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleRangeChange(days: number) {
    setSelectedDays(days);
    setRunResult(null);
    const resolved = resolvePresetRange(days);
    if (!resolved.ok) return;
    setRange({ from: resolved.from, to: resolved.to });
    await loadRecommendationsForRange(resolved.from, resolved.to);
  }

  async function handleRunAnalysis() {
    setIsRunning(true);
    setRunResult(null);
    try {
      const result = await runAnalysis({
        data: { firmSlug, from: range.from, to: range.to },
      });
      setRunResult(result);
      if (result.kind === "completed") {
        await loadRecommendationsForRange(range.from, range.to);
      }
    } finally {
      setIsRunning(false);
    }
  }

  const grouped = groupByFormat(recommendations);
  const message = resultMessage(runResult);
  const isLoadingList = isRunning || isRefreshing;

  return (
    <section className="flex flex-col gap-5 p-4 md:p-6" aria-label="Content recommendations">
      <div className="flex flex-col gap-4 border-border/60 border-b pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ChartBar className="text-primary size-4" weight="duotone" aria-hidden />
              <h3 className="text-foreground text-sm font-semibold tracking-tight">
                Draft recommendations
              </h3>
            </div>
            <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-sm">
              <CalendarBlank className="size-3.5 shrink-0" aria-hidden />
              <span>
                Scoped to <span className="text-foreground font-medium">{rangeLabel}</span>
              </span>
            </p>
          </div>
          <Button
            type="button"
            className={cn(
              "group rounded-full px-4 active:scale-[0.98] disabled:opacity-50",
              DASHBOARD_MOTION,
            )}
            disabled={isRunning}
            onClick={handleRunAnalysis}
            aria-busy={isRunning}
          >
            <span className="bg-primary-foreground/15 mr-2 inline-flex size-6 items-center justify-center rounded-full transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5 group-hover:-translate-y-px">
              <Play className="size-3.5" weight="fill" aria-hidden />
            </span>
            {isRunning ? "Analyzing conversations…" : "Run analysis"}
          </Button>
        </div>

        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Analysis date range"
        >
          {RANGE_PRESETS.map((preset) => (
            <button
              key={preset.days}
              type="button"
              onClick={() => handleRangeChange(preset.days)}
              disabled={isLoadingList}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium active:scale-[0.98] disabled:opacity-50",
                DASHBOARD_MOTION,
                selectedDays === preset.days
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border/60 text-muted-foreground hover:bg-muted/40 hover:text-foreground",
              )}
            >
              Last {preset.label}
            </button>
          ))}
        </div>
      </div>

      {message ? (
        <p
          className={cn("rounded-lg bg-muted/30 px-3 py-2 text-sm", resultTone(runResult))}
          role="status"
          aria-live="polite"
        >
          {message}
        </p>
      ) : null}

      {isLoadingList && recommendations.length === 0 ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading recommendations">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      ) : recommendations.length === 0 ? (
        <DashboardEmptyState
          title="No drafts in this timeframe"
          description={`Run analysis after at least three conversations exist between ${rangeLabel}.`}
        />
      ) : (
        <div className="space-y-6">
          {[...grouped.entries()].map(([format, items]) => (
            <div key={format}>
              <div className="mb-2 flex items-center gap-2">
                <h4 className="text-foreground text-sm font-semibold tracking-tight">
                  {formatLabel(format)}
                </h4>
                <Badge variant="secondary" className="rounded-full text-[11px]">
                  {items.length}
                </Badge>
              </div>
              <DashboardListPanel>
                {items.map((rec) => (
                  <div key={rec.id} className="space-y-2 px-4 py-3.5 md:px-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-foreground text-sm font-medium">{rec.title}</p>
                        <p className="text-muted-foreground mt-0.5 text-sm">{rec.rationale}</p>
                      </div>
                      <Badge variant="outline" className="rounded-full text-[11px] uppercase">
                        Draft
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      Topic: {rec.topic} ·{" "}
                      <span className="font-mono">{rec.sourceConversationCount}</span> source
                      conversation(s)
                    </p>
                    {rec.draft ? (
                      <p className="text-muted-foreground line-clamp-3 rounded-md bg-muted/30 px-3 py-2 text-xs whitespace-pre-wrap">
                        {rec.draft}
                      </p>
                    ) : null}
                    {rec.format === "video_brief" ? (
                      <p className="text-muted-foreground text-xs">
                        Video idea brief only — no video asset generated.
                      </p>
                    ) : null}
                  </div>
                ))}
              </DashboardListPanel>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
