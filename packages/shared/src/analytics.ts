export type ConversationAnalysisStatus = "pending" | "completed" | "failed" | "partial";

export interface ConversationAnalysisRun {
  id: string;
  firmId: string;
  conversationId: string;
  status: ConversationAnalysisStatus;
  analysis: Record<string, unknown>;
  createdAt: string;
}

export type ContentInsightRunStatus = "running" | "completed" | "failed";

export interface ContentInsightRun {
  id: string;
  firmId: string;
  fromDate?: string;
  toDate?: string;
  status: ContentInsightRunStatus;
  summary?: string;
  createdAt: string;
  completedAt?: string;
}

export interface ContentRecommendationInput {
  topic: string;
  format: "linkedin_post" | "blog_post" | "email_sequence" | "video_brief" | "report";
  title: string;
  rationale: string;
  targetAudience?: string;
  sourceConversationCount: number;
  draft?: string;
}

export interface ConversationAnalystOutput {
  topics: string[];
  serviceCategory: string;
  urgency: "low" | "medium" | "high";
  leadReadiness: "cold" | "warm" | "hot";
  userQuestions: string[];
  objections: string[];
  contentOpportunities: Array<{
    topic: string;
    angle: string;
    format: string;
    reason: string;
  }>;
}

export const INSIGHT_DEFAULT_RANGE_DAYS = 30;
export const INSIGHT_MAX_RANGE_DAYS = 180;
export const INSIGHT_MIN_CONVERSATION_COUNT = 3;

export type InsightDateRangeInput = {
  from?: string;
  to?: string;
};

export type InsightDateRangeError =
  | { code: "from_after_to" }
  | { code: "range_too_large" }
  | { code: "invalid_date" };

export function resolveInsightDateRange(
  input: InsightDateRangeInput,
  now: Date = new Date(),
): { ok: true; from: string; to: string } | { ok: false; error: InsightDateRangeError } {
  const toDate = input.to ? new Date(input.to) : now;
  const fromDate = input.from
    ? new Date(input.from)
    : new Date(toDate.getTime() - INSIGHT_DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);

  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return { ok: false, error: { code: "invalid_date" } };
  }
  if (fromDate > toDate) {
    return { ok: false, error: { code: "from_after_to" } };
  }

  const diffDays = (toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000);
  if (diffDays > INSIGHT_MAX_RANGE_DAYS) {
    return { ok: false, error: { code: "range_too_large" } };
  }

  return { ok: true, from: fromDate.toISOString(), to: toDate.toISOString() };
}

export interface FirmTopicSummary {
  topic: string;
  normalizedTopic: string;
  conversationCount: number;
}

export interface FirmContentRecommendation {
  id: string;
  firmId: string;
  insightRunId?: string;
  topic: string;
  format: ContentRecommendationInput["format"];
  title: string;
  rationale: string;
  targetAudience?: string;
  sourceConversationCount: number;
  draft?: string;
  status: "draft";
  createdAt: string;
}

export type ContentInsightActionResult =
  | {
      kind: "completed";
      runId: string;
      savedRecommendationCount: number;
      message: string;
    }
  | {
      kind: "failed";
      runId: string;
      message: string;
    }
  | {
      kind: "empty";
      message: string;
    }
  | {
      kind: "not_enough_data";
      conversationCount: number;
      message: string;
    }
  | {
      kind: "firm_not_found";
      message: string;
    }
  | {
      kind: "firm_inactive";
      message: string;
    }
  | {
      kind: "validation_error";
      code: string;
      message: string;
    };
