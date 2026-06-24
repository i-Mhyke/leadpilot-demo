import { describe, expect, it, vi, beforeEach } from "vitest";
import { setSqlForTests } from "./client.ts";
import {
  createContentInsightRun,
  createContentRecommendations,
  markContentInsightRunCompleted,
  summarizeContentInsightTopics,
} from "./analytics.ts";
import {
  getFirmConversationInsightsBySlug,
  listFirmContentRecommendationsBySlug,
  runOnDemandContentInsight,
  validateInsightDateRange,
} from "./content-intelligence.ts";

vi.mock("./firms.ts", () => ({
  getFirmBySlug: vi.fn(),
}));

import { getFirmBySlug } from "./firms.ts";

const activeFirm = {
  id: "firm-a",
  name: "Demo Law",
  slug: "demo-law",
  industry: "legal" as const,
  status: "active" as const,
};

function firmLookup() {
  return vi.mocked(getFirmBySlug).mockResolvedValue(activeFirm);
}

describe("content intelligence read models", () => {
  beforeEach(() => {
    setSqlForTests(null);
    vi.clearAllMocks();
  });

  it("shouldListOnlyFirmTopics", async () => {
    firmLookup();
    const sql = vi
      .fn()
      .mockResolvedValueOnce([
        {
          topic: "SAFE notes",
          normalized_topic: "safe notes",
          conversation_count: "2",
        },
      ])
      .mockResolvedValueOnce([{ count: "2" }]);
    setSqlForTests(sql as never);

    const insights = await getFirmConversationInsightsBySlug({ firmSlug: "demo-law" });
    expect(insights.kind).toBe("ok");
    if (insights.kind === "ok") {
      expect(insights.topics).toHaveLength(1);
      expect(insights.topics[0]?.topic).toBe("SAFE notes");
    }
  });

  it("shouldListOnlyFirmContentRecommendations", async () => {
    firmLookup();
    const sql = vi.fn().mockResolvedValueOnce([
      {
        id: "rec-1",
        firm_id: "firm-a",
        insight_run_id: "run-1",
        topic: "SAFE notes",
        format: "blog_post",
        title: "Founder guide",
        rationale: "Repeated questions",
        target_audience: "Founders",
        source_conversation_count: 3,
        draft: "Draft body",
        status: "draft",
        created_at: "2026-01-15T00:00:00.000Z",
      },
    ]);
    setSqlForTests(sql as never);

    const result = await listFirmContentRecommendationsBySlug({ firmSlug: "demo-law" });
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.recommendations[0]?.firmId).toBe("firm-a");
      expect(result.recommendations[0]?.status).toBe("draft");
    }
  });

  it("shouldRejectInvalidDateRange", () => {
    const result = validateInsightDateRange({
      from: "2026-02-01T00:00:00.000Z",
      to: "2026-01-01T00:00:00.000Z",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("from_after_to");
    }
  });

  it("shouldNotCreateAnalysisRuns", async () => {
    firmLookup();
    const sql = vi.fn().mockResolvedValue([]);
    setSqlForTests(sql as never);

    await listFirmContentRecommendationsBySlug({ firmSlug: "demo-law" });
    const insertCalls = sql.mock.calls.filter((call) => {
      const query = String(call[0]?.[0] ?? "");
      return query.includes("INSERT INTO conversation_analysis_runs");
    });
    expect(insertCalls).toHaveLength(0);
  });

  it("shouldNotCreateRecommendations", async () => {
    firmLookup();
    const sql = vi.fn().mockResolvedValue([]);
    setSqlForTests(sql as never);

    await getFirmConversationInsightsBySlug({ firmSlug: "demo-law" });
    const insertCalls = sql.mock.calls.filter((call) => {
      const query = String(call[0]?.[0] ?? "");
      return query.includes("INSERT INTO content_recommendations");
    });
    expect(insertCalls).toHaveLength(0);
  });
});

const sampleConversationRow = {
  id: "conv-1",
  firm_id: "firm-a",
  visitor_id: "visitor-1",
  eve_session_id: null,
  eve_continuation_token: null,
  status: "open",
  phase: "listen",
  source_url: null,
  firm_slug: "demo-law",
  matter_summary: "Fundraising SAFE notes",
  primary_service_id: null,
  last_message_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

function mockInsightPreludeSql(
  sql: ReturnType<typeof vi.fn>,
  input: {
    count: string;
    runningRunId?: string;
    topics?: Array<{ topic: string; normalized_topic: string; conversation_count: string }>;
    conversations?: unknown[];
  },
) {
  sql.mockResolvedValueOnce([{ count: input.count }]);
  if (input.runningRunId) {
    sql.mockResolvedValueOnce([{ id: input.runningRunId }]);
  } else {
    sql.mockResolvedValueOnce([]);
  }
  sql.mockResolvedValueOnce(input.topics ?? []);
  sql.mockResolvedValueOnce(input.conversations ?? [sampleConversationRow]);
}

describe("on-demand content intelligence", () => {
  beforeEach(() => {
    setSqlForTests(null);
    vi.clearAllMocks();
  });

  it("shouldRejectBrowserFirmId", async () => {
    const result = await runOnDemandContentInsight({
      firmSlug: "demo-law",
      firmId: "evil-firm",
    });
    expect(result.kind).toBe("validation_error");
    if (result.kind === "validation_error") {
      expect(result.code).toBe("browser_firm_id_rejected");
    }
    expect(getFirmBySlug).not.toHaveBeenCalled();
  });

  it("shouldRejectDateRangeAbove180Days", async () => {
    const result = await runOnDemandContentInsight({
      firmSlug: "demo-law",
      from: "2025-01-01T00:00:00.000Z",
      to: "2026-06-18T00:00:00.000Z",
    });
    expect(result.kind).toBe("validation_error");
    if (result.kind === "validation_error") {
      expect(result.code).toBe("range_too_large");
    }
  });

  it("shouldRejectFromAfterTo", async () => {
    const result = await runOnDemandContentInsight({
      firmSlug: "demo-law",
      from: "2026-06-01T00:00:00.000Z",
      to: "2026-01-01T00:00:00.000Z",
    });
    expect(result.kind).toBe("validation_error");
    if (result.kind === "validation_error") {
      expect(result.code).toBe("from_after_to");
    }
  });

  it("shouldNotCreateRunForUnknownFirm", async () => {
    vi.mocked(getFirmBySlug).mockResolvedValue({ kind: "not_found", slug: "missing" });
    const sql = vi.fn();
    setSqlForTests(sql as never);

    const result = await runOnDemandContentInsight({ firmSlug: "missing" });
    expect(result.kind).toBe("firm_not_found");
    expect(sql).not.toHaveBeenCalled();
  });

  it("shouldNotCreateRunForInactiveFirm", async () => {
    vi.mocked(getFirmBySlug).mockResolvedValue({ kind: "inactive", slug: "demo-law" });
    const sql = vi.fn();
    setSqlForTests(sql as never);

    const result = await runOnDemandContentInsight({ firmSlug: "demo-law" });
    expect(result.kind).toBe("firm_inactive");
    expect(sql).not.toHaveBeenCalled();
  });

  it("shouldNotCreateRecommendationsForEmptyConversationSet", async () => {
    firmLookup();
    const sql = vi.fn().mockResolvedValueOnce([{ count: "0" }]);
    setSqlForTests(sql as never);

    const result = await runOnDemandContentInsight({ firmSlug: "demo-law" });
    expect(result.kind).toBe("empty");
    const insertCalls = sql.mock.calls.filter((call) => {
      const query = String(call[0]?.[0] ?? "");
      return query.includes("INSERT INTO content_insight_runs");
    });
    expect(insertCalls).toHaveLength(0);
  });

  it("shouldReturnNotEnoughDataBelowMinimumConversationCount", async () => {
    firmLookup();
    const sql = vi.fn().mockResolvedValueOnce([{ count: "2" }]);
    setSqlForTests(sql as never);

    const result = await runOnDemandContentInsight({ firmSlug: "demo-law" });
    expect(result.kind).toBe("not_enough_data");
    if (result.kind === "not_enough_data") {
      expect(result.conversationCount).toBe(2);
    }
  });

  it("shouldCreateRunningRunBeforeAggregation", async () => {
    firmLookup();
    const sql = vi.fn();
    mockInsightPreludeSql(sql, {
      count: "3",
      topics: [
        {
          topic: "SAFE notes",
          normalized_topic: "safe notes",
          conversation_count: "3",
        },
      ],
    });
    sql.mockResolvedValue([{ id: "rec-1", created_at: "2026-01-01T00:00:00.000Z" }]);
    setSqlForTests(sql as never);

    const result = await runOnDemandContentInsight({ firmSlug: "demo-law" });
    expect(result.kind).toBe("completed");

    const runInsert = sql.mock.calls.find((call) =>
      String(call[0]?.[0] ?? "").includes("INSERT INTO content_insight_runs"),
    );
    expect(runInsert).toBeDefined();
    expect(runInsert?.flat().join(" ")).toContain("running");
  });

  it("shouldMarkRunCompletedAfterSavingDrafts", async () => {
    firmLookup();
    const sql = vi.fn();
    mockInsightPreludeSql(sql, {
      count: "4",
      topics: [
        {
          topic: "NDPA compliance",
          normalized_topic: "ndpa compliance",
          conversation_count: "4",
        },
      ],
    });
    sql.mockResolvedValue([{ id: "rec-2", created_at: "2026-01-02T00:00:00.000Z" }]);
    setSqlForTests(sql as never);

    const result = await runOnDemandContentInsight({ firmSlug: "demo-law" });
    expect(result.kind).toBe("completed");

    const completedUpdate = sql.mock.calls.find((call) =>
      String(call[0]?.[0] ?? "").includes("status = 'completed'"),
    );
    expect(completedUpdate).toBeDefined();
  });

  it("shouldCreateFailedRunWhenAggregationFails", async () => {
    firmLookup();
    const sql = vi.fn();
    mockInsightPreludeSql(sql, { count: "3", topics: [], conversations: [] });
    sql.mockResolvedValue([]);
    setSqlForTests(sql as never);

    const result = await runOnDemandContentInsight({ firmSlug: "demo-law" });
    expect(result.kind).toBe("failed");
    if (result.kind === "failed") {
      expect(result.runId).toMatch(/^[0-9a-f-]{36}$/i);
    }

    const recommendationInsert = sql.mock.calls.filter((call) =>
      String(call[0]?.[0] ?? "").includes("INSERT INTO content_recommendations"),
    );
    expect(recommendationInsert).toHaveLength(0);
  });

  it("shouldCreateDraftRecommendationsOnly", async () => {
    firmLookup();
    const sql = vi.fn();
    mockInsightPreludeSql(sql, {
      count: "5",
      topics: [
        {
          topic: "SAFE notes",
          normalized_topic: "safe notes",
          conversation_count: "5",
        },
      ],
    });
    sql.mockResolvedValue([{ id: "rec-3", created_at: "2026-01-03T00:00:00.000Z" }]);
    setSqlForTests(sql as never);

    await runOnDemandContentInsight({ firmSlug: "demo-law" });

    const recommendationInsert = sql.mock.calls.find((call) =>
      String(call[0]?.[0] ?? "").includes("INSERT INTO content_recommendations"),
    );
    expect(recommendationInsert?.flat().join(" ")).toContain("draft");
  });

  it("shouldRejectConcurrentRunForSameDateRange", async () => {
    firmLookup();
    const sql = vi.fn();
    mockInsightPreludeSql(sql, { count: "3", runningRunId: "run-in-flight" });
    setSqlForTests(sql as never);

    const result = await runOnDemandContentInsight({ firmSlug: "demo-law" });
    expect(result.kind).toBe("failed");
    if (result.kind === "failed") {
      expect(result.runId).toBe("run-in-flight");
      expect(result.message).toContain("already in progress");
    }

    const recommendationInsert = sql.mock.calls.filter((call) =>
      String(call[0]?.[0] ?? "").includes("INSERT INTO content_recommendations"),
    );
    expect(recommendationInsert).toHaveLength(0);
  });

  it("shouldIncludeConversationSummariesInDraftRationale", async () => {
    firmLookup();
    const sql = vi.fn();
    mockInsightPreludeSql(sql, {
      count: "3",
      topics: [
        {
          topic: "SAFE notes",
          normalized_topic: "safe notes",
          conversation_count: "3",
        },
      ],
      conversations: [
        { ...sampleConversationRow, matter_summary: "Need NDPA review" },
        { ...sampleConversationRow, id: "conv-2", matter_summary: "SAFE fundraising" },
      ],
    });
    sql.mockResolvedValue([{ id: "rec-1", created_at: "2026-01-01T00:00:00.000Z" }]);
    setSqlForTests(sql as never);

    const result = await runOnDemandContentInsight({ firmSlug: "demo-law" });
    expect(result.kind).toBe("completed");

    const conversationSelect = sql.mock.calls.find((call) => {
      const query = String(call[0]?.[0] ?? "");
      return query.includes("FROM conversations") && query.includes("matter_summary");
    });
    expect(conversationSelect).toBeDefined();

    const recommendationInsert = sql.mock.calls.find((call) =>
      call.some((part) => String(part).includes("NDPA review")),
    );
    expect(recommendationInsert).toBeDefined();
  });

  it("shouldRepresentVideoAsVideoBriefWithoutExternalCall", async () => {
    firmLookup();
    const sql = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = strings.join(" ");
      if (query.includes("COUNT(*)")) return [{ count: "6" }];
      if (query.includes("content_insight_runs") && query.includes("running")) return [];
      if (query.includes("conversation_topics")) {
        return [
          { topic: "Topic A", normalized_topic: "topic a", conversation_count: "2" },
          { topic: "Topic B", normalized_topic: "topic b", conversation_count: "2" },
          { topic: "Topic C", normalized_topic: "topic c", conversation_count: "2" },
          { topic: "Topic D", normalized_topic: "topic d", conversation_count: "2" },
        ];
      }
      if (query.includes("FROM conversations") && query.includes("matter_summary")) {
        return [sampleConversationRow];
      }
      if (query.includes("INSERT INTO content_insight_runs")) return [];
      if (query.includes("INSERT INTO content_recommendations")) {
        const format = values[3];
        return [{ id: `rec-${format}`, created_at: "2026-01-04T00:00:00.000Z" }];
      }
      if (query.includes("status = 'completed'")) return [];
      return [];
    });
    setSqlForTests(sql as never);

    const result = await runOnDemandContentInsight({ firmSlug: "demo-law" });
    expect(result.kind).toBe("completed");

    const recommendationInserts = sql.mock.calls.filter((call) =>
      String(call[0]?.join?.(" ") ?? call[0]?.[0] ?? "").includes("INSERT INTO content_recommendations"),
    );
    expect(recommendationInserts.some((call) => call.includes("video_brief"))).toBe(true);
  });

  it("shouldNotPersistPartialRecommendationsWhenSaveFails", async () => {
    firmLookup();
    let recommendationInsertCount = 0;
    let transactionCalls = 0;
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const query = strings.join(" ");
      if (query.includes("COUNT(*)")) return [{ count: "3" }];
      if (query.includes("content_insight_runs") && query.includes("running")) return [];
      if (query.includes("conversation_topics")) {
        return [
          { topic: "Topic A", normalized_topic: "topic a", conversation_count: "2" },
          { topic: "Topic B", normalized_topic: "topic b", conversation_count: "2" },
        ];
      }
      if (query.includes("FROM conversations") && query.includes("matter_summary")) {
        return [sampleConversationRow];
      }
      if (query.includes("INSERT INTO content_recommendations")) {
        recommendationInsertCount += 1;
        if (recommendationInsertCount >= 2) {
          throw new Error("db write failed");
        }
        return [{ id: `rec-${recommendationInsertCount}`, created_at: "2026-01-01T00:00:00.000Z" }];
      }
      if (query.includes("status = 'failed'")) return [];
      if (query.includes("status = 'completed'")) return [];
      return [];
    }) as ReturnType<typeof vi.fn> & {
      transaction: ReturnType<typeof vi.fn>;
    };

    sql.transaction = vi.fn(async (queriesOrFn) => {
      transactionCalls += 1;
      const queries =
        typeof queriesOrFn === "function" ? queriesOrFn(sql as never) : queriesOrFn;
      const results = [];
      try {
        for (const query of queries) {
          results.push(await query);
        }
        return results;
      } catch (error) {
        results.length = 0;
        throw error;
      }
    });

    setSqlForTests(sql as never);

    const result = await runOnDemandContentInsight({ firmSlug: "demo-law" });
    expect(result.kind).toBe("failed");
    if (result.kind === "failed") {
      expect(result.runId).toMatch(/^[0-9a-f-]{36}$/i);
      expect(result.runId).not.toBe("unavailable");
    }

    expect(transactionCalls).toBeGreaterThanOrEqual(1);
    expect(recommendationInsertCount).toBe(2);

    const deleteCall = sql.mock.calls.find((call) =>
      String(call[0]?.join?.(" ") ?? call[0]?.[0] ?? "").includes("DELETE FROM content_recommendations"),
    );
    expect(deleteCall).toBeUndefined();
  });
});

describe("content insight run helpers", () => {
  beforeEach(() => {
    setSqlForTests(null);
  });

  it("creates a running insight run row", async () => {
    const sql = vi.fn().mockResolvedValue([{ id: "run-99" }]);
    setSqlForTests(sql as never);

    const runId = await createContentInsightRun({
      firmId: "firm-a",
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-01-31T00:00:00.000Z",
    });
    expect(runId).toBe("run-99");
  });

  it("summarizes topics for aggregation", async () => {
    const sql = vi.fn().mockResolvedValue([
      {
        topic: "SAFE notes",
        normalized_topic: "safe notes",
        conversation_count: "3",
      },
    ]);
    setSqlForTests(sql as never);

    const topics = await summarizeContentInsightTopics({
      firmId: "firm-a",
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-01-31T00:00:00.000Z",
    });
    expect(topics[0]?.conversationCount).toBe(3);
  });

  it("marks runs completed and saves draft recommendations", async () => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValue([{ id: "rec-1", created_at: "2026-01-01T00:00:00.000Z" }]);
    setSqlForTests(sql as never);

    await markContentInsightRunCompleted({ runId: "run-1", summary: "done" });
    const saved = await createContentRecommendations("firm-a", [
      {
        topic: "SAFE notes",
        format: "blog_post",
        title: "Guide",
        rationale: "Questions",
        sourceConversationCount: 3,
      },
    ]);
    expect(saved[0]?.sourceConversationCount).toBe(3);
  });
});
