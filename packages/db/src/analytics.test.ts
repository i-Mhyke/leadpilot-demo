import { describe, expect, it, vi, beforeEach } from "vitest";
import { setSqlForTests } from "./client.ts";
import { listRecentConversations } from "./conversations.ts";
import {
  commitContentInsightRunWithRecommendations,
  createContentRecommendations,
  recordConversationTopic,
} from "./analytics.ts";
import { FirmOwnershipError } from "./firm-ownership.ts";

describe("analytics db helpers", () => {
  beforeEach(() => {
    setSqlForTests(null);
  });

  it("scopes recent conversations by firm id", async () => {
    const sql = vi.fn()
      .mockResolvedValueOnce([
        {
          id: "conv-1",
          firm_id: "firm-a",
          visitor_id: "visitor-1",
          eve_session_id: null,
          eve_continuation_token: null,
          status: "open",
          phase: "listen",
          source_url: null,
          firm_slug: "demo-law",
          matter_summary: null,
          primary_service_id: null,
          last_message_at: null,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ])
      .mockResolvedValueOnce([]);

    setSqlForTests(sql as never);

    const conversations = await listRecentConversations({ firmId: "firm-a", limit: 10 });
    expect(conversations).toHaveLength(1);
    expect(conversations[0]?.firmId).toBe("firm-a");
    expect(sql).toHaveBeenCalled();
  });

  it("stores content recommendations as draft with source counts", async () => {
    const sql = vi.fn().mockResolvedValue([
      { id: "rec-1", created_at: "2026-01-01T00:00:00.000Z" },
    ]);
    setSqlForTests(sql as never);

    const saved = await createContentRecommendations("firm-a", [
      {
        topic: "SAFE notes",
        format: "blog_post",
        title: "Founder guide to SAFE notes",
        rationale: "Repeated visitor questions",
        sourceConversationCount: 3,
      },
    ]);

    expect(saved[0]?.sourceConversationCount).toBe(3);
  });

  it("rejects cross-firm conversation topics before insert", async () => {
    const sql = vi.fn().mockResolvedValue([]);
    setSqlForTests(sql as never);

    await expect(
      recordConversationTopic({
        firmId: "firm-a",
        conversationId: "conv-b",
        topic: "SAFE notes",
        normalizedTopic: "safe notes",
      }),
    ).rejects.toBeInstanceOf(FirmOwnershipError);
  });
});

describe("content insight run commits", () => {
  beforeEach(() => {
    setSqlForTests(null);
  });

  it("shouldCommitContentInsightRunInSingleTransaction", async () => {
    let transactionCalls = 0;
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const query = strings.join(" ");
      if (query.includes("INSERT INTO content_insight_runs")) return [];
      if (query.includes("INSERT INTO content_recommendations")) {
        return [{ id: "rec-1", created_at: "2026-01-01T00:00:00.000Z" }];
      }
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
      for (const query of queries) {
        results.push(await query);
      }
      return results;
    });

    setSqlForTests(sql as never);

    const result = await commitContentInsightRunWithRecommendations({
      firmId: "firm-a",
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-01-31T00:00:00.000Z",
      summary: "Saved 1 draft recommendation(s).",
      recommendations: [
        {
          topic: "SAFE notes",
          format: "blog_post",
          title: "Guide",
          rationale: "Questions",
          sourceConversationCount: 3,
        },
      ],
    });

    expect(transactionCalls).toBe(1);
    expect(result.runId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(result.saved).toHaveLength(1);
  });

  it("shouldNotReturnSavedRecommendationsWhenCommitTransactionFails", async () => {
    let recommendationInsertCount = 0;
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const query = strings.join(" ");
      if (query.includes("INSERT INTO content_recommendations")) {
        recommendationInsertCount += 1;
        if (recommendationInsertCount >= 2) {
          throw new Error("db write failed");
        }
        return [{ id: `rec-${recommendationInsertCount}`, created_at: "2026-01-01T00:00:00.000Z" }];
      }
      return [];
    });

    setSqlForTests(sql as never);

    await expect(
      commitContentInsightRunWithRecommendations({
        firmId: "firm-a",
        from: "2026-01-01T00:00:00.000Z",
        to: "2026-01-31T00:00:00.000Z",
        summary: "Saved 2 draft recommendation(s).",
        recommendations: [
          {
            topic: "Topic A",
            format: "blog_post",
            title: "A",
            rationale: "A",
            sourceConversationCount: 2,
          },
          {
            topic: "Topic B",
            format: "linkedin_post",
            title: "B",
            rationale: "B",
            sourceConversationCount: 2,
          },
        ],
      }),
    ).rejects.toThrow("db write failed");

    expect(recommendationInsertCount).toBe(2);
  });
});
