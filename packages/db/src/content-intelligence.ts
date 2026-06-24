import type {
  ContentInsightActionResult,
  ContentRecommendationInput,
  FirmContentRecommendation,
  FirmTopicSummary,
  InsightDateRangeInput,
} from "@leadpilot/shared";
import {
  INSIGHT_MIN_CONVERSATION_COUNT,
  resolveInsightDateRange,
} from "@leadpilot/shared";
import {
  commitContentInsightRunWithRecommendations,
  countFirmConversationsInRange,
  failContentInsightRun,
  findRunningContentInsightRunForRange,
  listContentInsightSourceConversations,
  summarizeContentInsightTopics,
} from "./analytics.ts";
import { getSql } from "./client.ts";
import { getFirmBySlug } from "./firms.ts";
import { rows as toRows } from "./sql.ts";

export type OnDemandContentInsightInput = {
  firmSlug: string;
  from?: string;
  to?: string;
};

const FORMAT_ROTATION: ContentRecommendationInput["format"][] = [
  "blog_post",
  "linkedin_post",
  "email_sequence",
  "video_brief",
  "report",
];

export function validateInsightDateRange(input: InsightDateRangeInput) {
  return resolveInsightDateRange(input);
}

export function rejectBrowserFirmId(input: Record<string, unknown>): ContentInsightActionResult | null {
  if ("firmId" in input && input.firmId !== undefined) {
    return {
      kind: "validation_error",
      code: "browser_firm_id_rejected",
      message: "Firm scope must be resolved from the route slug on the server.",
    };
  }
  return null;
}

function buildDraftRecommendationsFromTopics(
  topics: FirmTopicSummary[],
  matterSummaries: string[],
): ContentRecommendationInput[] {
  const summarySnippet =
    matterSummaries.length > 0
      ? ` Example visitor matters: ${matterSummaries.slice(0, 2).join("; ")}.`
      : "";

  return topics.slice(0, 5).map((topic, index) => {
    const format = FORMAT_ROTATION[index % FORMAT_ROTATION.length]!;
    const isVideoBrief = format === "video_brief";
    return {
      topic: topic.topic,
      format,
      title: isVideoBrief
        ? `Video brief: ${topic.topic}`
        : `Content draft: ${topic.topic}`,
      rationale: `Visitors discussed "${topic.topic}" across ${topic.conversationCount} conversation(s) in the selected range.${summarySnippet}`,
      targetAudience: "Prospective clients asking similar questions",
      sourceConversationCount: topic.conversationCount,
      draft: isVideoBrief
        ? `Video brief outline\n\nHook: Common questions about ${topic.topic}\nKey points: address recurring visitor concerns\nVisitor context: ${matterSummaries.slice(0, 2).join("; ") || "See recent conversations in range"}\nCall to action: Book a consultation`
        : `Draft outline for ${topic.topic}\n\n- Common visitor questions\n- Practical guidance for prospective clients\n- Visitor context: ${matterSummaries.slice(0, 2).join("; ") || "See recent conversations in range"}\n- When to seek professional advice`,
    };
  });
}

export async function runOnDemandContentInsight(
  input: OnDemandContentInsightInput & Record<string, unknown>,
): Promise<ContentInsightActionResult> {
  const firmIdRejection = rejectBrowserFirmId(input);
  if (firmIdRejection) return firmIdRejection;

  const range = validateInsightDateRange({ from: input.from, to: input.to });
  if (!range.ok) {
    const code = range.error.code;
    const message =
      code === "from_after_to"
        ? "The start date must be before the end date."
        : code === "range_too_large"
          ? "Date range cannot exceed 180 days."
          : "Provide a valid date range.";
    return { kind: "validation_error", code, message };
  }

  const firm = await getFirmBySlug(input.firmSlug);
  if ("kind" in firm) {
    if (firm.kind === "inactive") {
      return { kind: "firm_inactive", message: `Firm "${input.firmSlug}" is inactive.` };
    }
    return { kind: "firm_not_found", message: `Firm "${input.firmSlug}" was not found.` };
  }

  const conversationCount = await countFirmConversationsInRange({
    firmId: firm.id,
    from: range.from,
    to: range.to,
  });

  if (conversationCount === 0) {
    return {
      kind: "empty",
      message: "No conversations were found in the selected date range.",
    };
  }

  if (conversationCount < INSIGHT_MIN_CONVERSATION_COUNT) {
    return {
      kind: "not_enough_data",
      conversationCount,
      message: `At least ${INSIGHT_MIN_CONVERSATION_COUNT} conversations are required. Found ${conversationCount}.`,
    };
  }

  const inFlightRunId = await findRunningContentInsightRunForRange({
    firmId: firm.id,
    from: range.from,
    to: range.to,
  });
  if (inFlightRunId) {
    return {
      kind: "failed",
      runId: inFlightRunId,
      message: "An analysis is already in progress for this date range. Wait for it to finish before running again.",
    };
  }

  try {
    const [topics, sourceConversations] = await Promise.all([
      summarizeContentInsightTopics({
        firmId: firm.id,
        from: range.from,
        to: range.to,
      }),
      listContentInsightSourceConversations({
        firmId: firm.id,
        from: range.from,
        to: range.to,
      }),
    ]);

    const matterSummaries = sourceConversations
      .map((conversation) => conversation.matterSummary?.trim())
      .filter((summary): summary is string => Boolean(summary));

    if (topics.length === 0) {
      const runId = await failContentInsightRun({
        firmId: firm.id,
        from: range.from,
        to: range.to,
        summary: "No topic signals were available for the selected conversations.",
      });
      return {
        kind: "failed",
        runId,
        message: "Analysis could not derive topics from the selected conversations.",
      };
    }

    const drafts = buildDraftRecommendationsFromTopics(topics, matterSummaries);
    const summary = `Saved ${drafts.length} draft recommendation(s) from ${conversationCount} conversation(s).`;
    const { runId, saved } = await commitContentInsightRunWithRecommendations({
      firmId: firm.id,
      from: range.from,
      to: range.to,
      summary,
      recommendations: drafts,
    });

    return {
      kind: "completed",
      runId,
      savedRecommendationCount: saved.length,
      message: summary,
    };
  } catch (error) {
    const failureSummary = error instanceof Error ? error.message : "Aggregation failed";
    const runId = await failContentInsightRun({
      firmId: firm.id,
      from: range.from,
      to: range.to,
      summary: failureSummary,
    });

    return {
      kind: "failed",
      runId,
      message: "Content insight run failed while saving recommendations.",
    };
  }
}

type RecommendationRow = {
  id: string;
  firm_id: string;
  insight_run_id: string | null;
  topic: string;
  format: FirmContentRecommendation["format"];
  title: string;
  rationale: string;
  target_audience: string | null;
  source_conversation_count: number;
  draft: string | null;
  status: string;
  created_at: string;
};

function mapRecommendation(row: RecommendationRow): FirmContentRecommendation {
  return {
    id: row.id,
    firmId: row.firm_id,
    insightRunId: row.insight_run_id ?? undefined,
    topic: row.topic,
    format: row.format,
    title: row.title,
    rationale: row.rationale,
    targetAudience: row.target_audience ?? undefined,
    sourceConversationCount: row.source_conversation_count,
    draft: row.draft ?? undefined,
    status: "draft",
    createdAt: row.created_at,
  };
}

export async function listFirmContentRecommendationsBySlug(input: {
  firmSlug: string;
  from?: string;
  to?: string;
}): Promise<
  | { kind: "ok"; recommendations: FirmContentRecommendation[] }
  | { kind: "firm_not_found" | "firm_inactive" }
  | { kind: "validation_error"; code: string }
> {
  const range = validateInsightDateRange({ from: input.from, to: input.to });
  if (!range.ok) {
    return { kind: "validation_error", code: range.error.code };
  }

  const firm = await getFirmBySlug(input.firmSlug);
  if ("kind" in firm) {
    return { kind: firm.kind === "inactive" ? "firm_inactive" : "firm_not_found" };
  }

  const sql = getSql();
  const rows = toRows<RecommendationRow>(await sql`
    SELECT id, firm_id, insight_run_id, topic, format, title, rationale,
           target_audience, source_conversation_count, draft, status, created_at
    FROM content_recommendations
    WHERE firm_id = ${firm.id}
      AND created_at >= ${range.from}::timestamptz
      AND created_at <= ${range.to}::timestamptz
    ORDER BY created_at DESC
  `);

  return { kind: "ok", recommendations: rows.map(mapRecommendation) };
}

export async function getFirmConversationInsightsBySlug(input: {
  firmSlug: string;
  from?: string;
  to?: string;
}): Promise<
  | {
      kind: "ok";
      topics: FirmTopicSummary[];
      conversationCount: number;
    }
  | { kind: "firm_not_found" | "firm_inactive" }
  | { kind: "validation_error"; code: string }
> {
  const range = validateInsightDateRange({ from: input.from, to: input.to });
  if (!range.ok) {
    return { kind: "validation_error", code: range.error.code };
  }

  const firm = await getFirmBySlug(input.firmSlug);
  if ("kind" in firm) {
    return { kind: firm.kind === "inactive" ? "firm_inactive" : "firm_not_found" };
  }

  const [topics, conversationCount] = await Promise.all([
    summarizeContentInsightTopics({
      firmId: firm.id,
      from: range.from,
      to: range.to,
    }),
    countFirmConversationsInRange({
      firmId: firm.id,
      from: range.from,
      to: range.to,
    }),
  ]);

  return { kind: "ok", topics, conversationCount };
}
