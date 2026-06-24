import type { ContentRecommendation, Conversation, FirmTopicSummary } from "@leadpilot/shared";
import { randomUUID } from "node:crypto";
import { getSql } from "./client.ts";
import { assertFirmConversation, assertFirmService } from "./firm-ownership.ts";
import { rows as toRows } from "./sql.ts";

type ConversationRow = {
  id: string;
  firm_id: string;
  visitor_id: string;
  eve_session_id: string | null;
  eve_continuation_token: string | null;
  eve_stream_index: number | null;
  status: string;
  phase: string;
  source_url: string | null;
  firm_slug: string | null;
  matter_summary: string | null;
  primary_service_id: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    firmId: row.firm_id,
    visitorId: row.visitor_id,
    eveSessionId: row.eve_session_id ?? undefined,
    eveContinuationToken: row.eve_continuation_token ?? undefined,
    eveStreamIndex: row.eve_stream_index ?? 0,
    status: row.status as Conversation["status"],
    phase: row.phase as Conversation["phase"],
    sourceUrl: row.source_url ?? undefined,
    firmSlug: row.firm_slug ?? undefined,
    matterSummary: row.matter_summary ?? undefined,
    primaryServiceId: row.primary_service_id ?? undefined,
    lastMessageAt: row.last_message_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function recordConversationTopic(input: {
  firmId: string;
  conversationId: string;
  topic: string;
  normalizedTopic: string;
  serviceId?: string;
  confidence?: number;
}): Promise<void> {
  await assertFirmConversation(input.firmId, input.conversationId);
  if (input.serviceId) {
    await assertFirmService(input.firmId, input.serviceId);
  }

  const sql = getSql();
  await sql`
    INSERT INTO conversation_topics (firm_id, conversation_id, topic, normalized_topic, service_id, confidence)
    VALUES (
      ${input.firmId},
      ${input.conversationId},
      ${input.topic},
      ${input.normalizedTopic},
      ${input.serviceId ?? null},
      ${input.confidence ?? null}
    )
  `;
}

export async function saveConversationAnalysis(input: {
  firmId: string;
  conversationId: string;
  status: string;
  analysis: Record<string, unknown>;
}): Promise<string> {
  await assertFirmConversation(input.firmId, input.conversationId);
  const sql = getSql();
  const rows = toRows<{ id: string }>(await sql`
    INSERT INTO conversation_analysis_runs (firm_id, conversation_id, status, analysis)
    VALUES (${input.firmId}, ${input.conversationId}, ${input.status}, ${JSON.stringify(input.analysis)})
    RETURNING id
  `);
  return rows[0]!.id;
}

export async function createContentRecommendations(
  firmId: string,
  recommendations: Array<{
    insightRunId?: string;
    topic: string;
    format: ContentRecommendation["format"];
    title: string;
    rationale: string;
    targetAudience?: string;
    sourceConversationCount: number;
    draft?: string;
  }>,
): Promise<ContentRecommendation[]> {
  const sql = getSql();
  const results: ContentRecommendation[] = [];

  for (const rec of recommendations) {
    const rows = toRows<{ id: string; created_at: string }>(await sql`
      INSERT INTO content_recommendations (
        firm_id, insight_run_id, topic, format, title, rationale,
        target_audience, source_conversation_count, draft, status
      )
      VALUES (
        ${firmId},
        ${rec.insightRunId ?? null},
        ${rec.topic},
        ${rec.format},
        ${rec.title},
        ${rec.rationale},
        ${rec.targetAudience ?? null},
        ${rec.sourceConversationCount},
        ${rec.draft ?? null},
        'draft'
      )
      RETURNING id, created_at
    `);
    results.push({
      id: rows[0]!.id,
      firmId,
      topic: rec.topic,
      format: rec.format,
      title: rec.title,
      rationale: rec.rationale,
      sourceConversationCount: rec.sourceConversationCount,
      createdAt: rows[0]!.created_at,
    });
  }

  return results;
}

export async function deleteContentRecommendationsForInsightRun(input: {
  insightRunId: string;
}): Promise<void> {
  const sql = getSql();
  await sql`
    DELETE FROM content_recommendations
    WHERE insight_run_id = ${input.insightRunId}
  `;
}

export async function countFirmConversationsInRange(input: {
  firmId: string;
  from: string;
  to: string;
}): Promise<number> {
  const sql = getSql();
  const rows = toRows<{ count: string }>(await sql`
    SELECT COUNT(*)::text AS count
    FROM conversations
    WHERE firm_id = ${input.firmId}
      AND created_at >= ${input.from}::timestamptz
      AND created_at <= ${input.to}::timestamptz
  `);
  return Number(rows[0]?.count ?? 0);
}

export async function listContentInsightSourceConversations(input: {
  firmId: string;
  from: string;
  to: string;
}): Promise<Conversation[]> {
  const sql = getSql();
  const rows = toRows<ConversationRow>(await sql`
    SELECT id, firm_id, visitor_id, eve_session_id, eve_continuation_token, eve_stream_index,
           status, phase, source_url, firm_slug, matter_summary,
           primary_service_id, last_message_at, created_at, updated_at
    FROM conversations
    WHERE firm_id = ${input.firmId}
      AND created_at >= ${input.from}::timestamptz
      AND created_at <= ${input.to}::timestamptz
    ORDER BY COALESCE(last_message_at, created_at) DESC
  `);
  return rows.map(mapConversation);
}

export async function findRunningContentInsightRunForRange(input: {
  firmId: string;
  from: string;
  to: string;
}): Promise<string | null> {
  const sql = getSql();
  const rows = toRows<{ id: string }>(await sql`
    SELECT id
    FROM content_insight_runs
    WHERE firm_id = ${input.firmId}
      AND from_date = ${input.from}::timestamptz
      AND to_date = ${input.to}::timestamptz
      AND status = 'running'
    ORDER BY created_at DESC
    LIMIT 1
  `);
  return rows[0]?.id ?? null;
}

export async function summarizeContentInsightTopics(input: {
  firmId: string;
  from: string;
  to: string;
}): Promise<FirmTopicSummary[]> {
  const sql = getSql();
  const rows = toRows<{
    topic: string;
    normalized_topic: string;
    conversation_count: string;
  }>(await sql`
    SELECT ct.topic,
           ct.normalized_topic,
           COUNT(DISTINCT ct.conversation_id)::text AS conversation_count
    FROM conversation_topics ct
    INNER JOIN conversations c
      ON c.id = ct.conversation_id AND c.firm_id = ct.firm_id
    WHERE ct.firm_id = ${input.firmId}
      AND c.created_at >= ${input.from}::timestamptz
      AND c.created_at <= ${input.to}::timestamptz
    GROUP BY ct.topic, ct.normalized_topic
    ORDER BY COUNT(DISTINCT ct.conversation_id) DESC, ct.topic ASC
  `);

  return rows.map((row) => ({
    topic: row.topic,
    normalizedTopic: row.normalized_topic,
    conversationCount: Number(row.conversation_count),
  }));
}

export async function createContentInsightRun(input: {
  firmId: string;
  from: string;
  to: string;
}): Promise<string> {
  const sql = getSql();
  const rows = toRows<{ id: string }>(await sql`
    INSERT INTO content_insight_runs (firm_id, from_date, to_date, status)
    VALUES (${input.firmId}, ${input.from}::timestamptz, ${input.to}::timestamptz, 'running')
    RETURNING id
  `);
  return rows[0]!.id;
}

export async function markContentInsightRunCompleted(input: {
  runId: string;
  summary?: string;
}): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE content_insight_runs
    SET status = 'completed',
        summary = ${input.summary ?? null},
        completed_at = now()
    WHERE id = ${input.runId}
  `;
}

export async function markContentInsightRunFailed(input: { runId: string; summary?: string }): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE content_insight_runs
    SET status = 'failed',
        summary = ${input.summary ?? null},
        completed_at = now()
    WHERE id = ${input.runId}
  `;
}

type InsightRecommendationInput = {
  insightRunId?: string;
  topic: string;
  format: ContentRecommendation["format"];
  title: string;
  rationale: string;
  targetAudience?: string;
  sourceConversationCount: number;
  draft?: string;
};

export async function commitContentInsightRunWithRecommendations(input: {
  firmId: string;
  from: string;
  to: string;
  summary: string;
  recommendations: InsightRecommendationInput[];
}): Promise<{ runId: string; saved: ContentRecommendation[] }> {
  const sql = getSql();
  const runId = randomUUID();

  const results = await sql.transaction((tx) => [
    tx`
      INSERT INTO content_insight_runs (id, firm_id, from_date, to_date, status)
      VALUES (${runId}, ${input.firmId}, ${input.from}::timestamptz, ${input.to}::timestamptz, 'running')
    `,
    ...input.recommendations.map(
      (rec) =>
        tx`
          INSERT INTO content_recommendations (
            firm_id, insight_run_id, topic, format, title, rationale,
            target_audience, source_conversation_count, draft, status
          )
          VALUES (
            ${input.firmId},
            ${runId},
            ${rec.topic},
            ${rec.format},
            ${rec.title},
            ${rec.rationale},
            ${rec.targetAudience ?? null},
            ${rec.sourceConversationCount},
            ${rec.draft ?? null},
            'draft'
          )
          RETURNING id, created_at
        `,
    ),
    tx`
      UPDATE content_insight_runs
      SET status = 'completed',
          summary = ${input.summary},
          completed_at = now()
      WHERE id = ${runId}
    `,
  ]);

  const recommendationResults = results.slice(1, -1) as Array<Array<{ id: string; created_at: string }>>;
  if (recommendationResults.length !== input.recommendations.length) {
    throw new Error("Content insight transaction returned an unexpected recommendation count.");
  }

  const saved = recommendationResults.map((rows, index) => {
    const rec = input.recommendations[index]!;
    return {
      id: rows[0]!.id,
      firmId: input.firmId,
      topic: rec.topic,
      format: rec.format,
      title: rec.title,
      rationale: rec.rationale,
      sourceConversationCount: rec.sourceConversationCount,
      createdAt: rows[0]!.created_at,
    };
  });

  return { runId, saved };
}

export async function failContentInsightRun(input: {
  firmId: string;
  from: string;
  to: string;
  summary: string;
}): Promise<string> {
  const sql = getSql();
  const runId = randomUUID();

  await sql.transaction((tx) => [
    tx`
      INSERT INTO content_insight_runs (id, firm_id, from_date, to_date, status)
      VALUES (${runId}, ${input.firmId}, ${input.from}::timestamptz, ${input.to}::timestamptz, 'running')
    `,
    tx`
      UPDATE content_insight_runs
      SET status = 'failed',
          summary = ${input.summary},
          completed_at = now()
      WHERE id = ${runId}
    `,
  ]);

  return runId;
}
