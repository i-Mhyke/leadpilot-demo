import type {
  ChatHistoryResult,
  Conversation,
  ConversationEvent,
  ConversationMetadata,
  ConversationMessage,
  FirmBrainSnapshot,
  Visitor,
} from "@leadpilot/shared";
import { assertFirmConversation } from "./firm-ownership.ts";
import { getFirmBrainSnapshotByFirmId } from "./firm-brain.ts";
import { getSql } from "./client.ts";
import { rows as toRows } from "./sql.ts";

export interface ClientContextInput {
  firmSlug: string;
  browserSessionId?: string;
  localConversationId?: string;
  sourceUrl?: string;
}

export type ConversationSessionCursor = {
  sessionId?: string;
  continuationToken?: string;
  streamIndex: number;
};

type VisitorRow = {
  id: string;
  firm_id: string;
  anonymous_key: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
};

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
  brain_snapshot?: Record<string, unknown> | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapVisitor(row: VisitorRow): Visitor {
  return {
    id: row.id,
    firmId: row.firm_id,
    anonymousKey: row.anonymous_key ?? undefined,
    name: row.name ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    companyName: row.company_name ?? undefined,
    source: row.source ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const CONVERSATION_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isConversationId(value?: string): value is string {
  return Boolean(value && CONVERSATION_ID_RE.test(value));
}

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
    brainSnapshot: row.brain_snapshot
      ? (row.brain_snapshot as unknown as FirmBrainSnapshot)
      : undefined,
    lastMessageAt: row.last_message_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toConversationBrainSnapshot(snapshot: FirmBrainSnapshot): Record<string, unknown> {
  return snapshot as unknown as Record<string, unknown>;
}

async function ensureConversationBrainSnapshot(input: {
  conversationId: string;
  firmId: string;
  brainSnapshot: FirmBrainSnapshot;
}): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE conversations
    SET brain_snapshot = ${JSON.stringify(toConversationBrainSnapshot(input.brainSnapshot))}::jsonb,
        updated_at = now()
    WHERE id = ${input.conversationId}
      AND firm_id = ${input.firmId}
      AND brain_snapshot IS NULL
  `;
}

export async function findOrCreateVisitor(input: {
  firmId: string;
  anonymousKey?: string;
  source?: string;
}): Promise<Visitor> {
  const sql = getSql();

  if (input.anonymousKey) {
    const existing = toRows<VisitorRow>(await sql`
      SELECT id, firm_id, anonymous_key, name, email, phone, company_name, source, created_at, updated_at
      FROM visitors
      WHERE firm_id = ${input.firmId} AND anonymous_key = ${input.anonymousKey}
      LIMIT 1
    `);
    if (existing[0]) return mapVisitor(existing[0]);
  }

  const inserted = toRows<VisitorRow>(await sql`
    INSERT INTO visitors (firm_id, anonymous_key, source)
    VALUES (${input.firmId}, ${input.anonymousKey ?? null}, ${input.source ?? "web"})
    RETURNING id, firm_id, anonymous_key, name, email, phone, company_name, source, created_at, updated_at
  `);
  return mapVisitor(inserted[0]!);
}

export async function findOrCreateConversation(input: {
  firmId: string;
  firmSlug: string;
  visitorId: string;
  browserSessionId?: string;
  localConversationId?: string;
  eveSessionId?: string;
  sourceUrl?: string;
}): Promise<Conversation> {
  const sql = getSql();

  if (isConversationId(input.localConversationId)) {
    const exact = toRows<ConversationRow>(await sql`
      SELECT id, firm_id, visitor_id, eve_session_id, eve_continuation_token, eve_stream_index,
             status, phase, source_url, firm_slug, matter_summary,
             primary_service_id, brain_snapshot, last_message_at, created_at, updated_at
      FROM conversations
      WHERE id = ${input.localConversationId}
        AND firm_id = ${input.firmId}
        AND status = 'open'
      LIMIT 1
    `);
    if (exact[0]) {
      const row = exact[0];
      if (input.eveSessionId && row.eve_session_id !== input.eveSessionId) {
        const updated = toRows<ConversationRow>(await sql`
          UPDATE conversations
          SET eve_session_id = ${input.eveSessionId},
              eve_continuation_token = NULL,
              eve_stream_index = 0,
              source_url = COALESCE(${input.sourceUrl ?? null}, source_url),
              updated_at = now()
          WHERE id = ${row.id} AND firm_id = ${input.firmId}
          RETURNING id, firm_id, visitor_id, eve_session_id, eve_continuation_token, eve_stream_index,
                    status, phase, source_url, firm_slug, matter_summary,
                    primary_service_id, brain_snapshot, last_message_at, created_at, updated_at
        `);
        return mapConversation(updated[0]!);
      }
      return mapConversation(row);
    }
  }

  if (input.browserSessionId) {
    const resumed = toRows<ConversationRow>(await sql`
      SELECT c.id, c.firm_id, c.visitor_id, c.eve_session_id, c.eve_continuation_token, c.eve_stream_index,
             c.status, c.phase, c.source_url, c.firm_slug, c.matter_summary,
             c.primary_service_id, c.brain_snapshot, c.last_message_at, c.created_at, c.updated_at
      FROM conversations c
      JOIN visitors v ON v.id = c.visitor_id
      WHERE c.firm_id = ${input.firmId}
        AND v.anonymous_key = ${input.browserSessionId}
        AND c.status = 'open'
      ORDER BY c.updated_at DESC
      LIMIT 1
    `);
    if (resumed[0]) {
      const row = resumed[0];
      if (input.eveSessionId && row.eve_session_id !== input.eveSessionId) {
        const updated = toRows<ConversationRow>(await sql`
          UPDATE conversations
          SET eve_session_id = ${input.eveSessionId},
              eve_continuation_token = NULL,
              eve_stream_index = 0,
              source_url = COALESCE(${input.sourceUrl ?? null}, source_url),
              updated_at = now()
          WHERE id = ${row.id} AND firm_id = ${input.firmId}
          RETURNING id, firm_id, visitor_id, eve_session_id, eve_continuation_token, eve_stream_index,
                    status, phase, source_url, firm_slug, matter_summary,
                    primary_service_id, brain_snapshot, last_message_at, created_at, updated_at
        `);
        return mapConversation(updated[0]!);
      }
      return mapConversation(row);
    }
  }

  if (input.eveSessionId) {
    const byEve = toRows<ConversationRow>(await sql`
      SELECT id, firm_id, visitor_id, eve_session_id, eve_continuation_token, eve_stream_index,
             status, phase, source_url, firm_slug, matter_summary,
             primary_service_id, brain_snapshot, last_message_at, created_at, updated_at
      FROM conversations
      WHERE firm_id = ${input.firmId} AND eve_session_id = ${input.eveSessionId}
      LIMIT 1
    `);
    if (byEve[0]) return mapConversation(byEve[0]);
  }

  const inserted = toRows<ConversationRow>(await sql`
    INSERT INTO conversations (firm_id, visitor_id, eve_session_id, firm_slug, source_url, status, phase)
    VALUES (
      ${input.firmId},
      ${input.visitorId},
      ${input.eveSessionId ?? null},
      ${input.firmSlug},
      ${input.sourceUrl ?? null},
      'open',
      'listen'
    )
    RETURNING id, firm_id, visitor_id, eve_session_id, eve_continuation_token, eve_stream_index,
              status, phase, source_url, firm_slug, matter_summary,
              primary_service_id, brain_snapshot, last_message_at, created_at, updated_at
  `);
  return mapConversation(inserted[0]!);
}

export async function persistVisitorMessage(input: {
  conversationId: string;
  firmId: string;
  content: string;
  eveTurnId?: string;
}): Promise<ConversationMessage | null> {
  const sql = getSql();
  const rows = toRows<{ id: string; created_at: string }>(await sql`
    INSERT INTO conversation_messages (conversation_id, firm_id, role, content, eve_turn_id, event_type)
    VALUES (${input.conversationId}, ${input.firmId}, 'visitor', ${input.content}, ${input.eveTurnId ?? null}, 'message.received')
    ON CONFLICT (conversation_id, eve_turn_id) WHERE eve_turn_id IS NOT NULL DO NOTHING
    RETURNING id, created_at
  `);
  if (!rows[0]) return null;

  await sql`
    UPDATE conversations
    SET last_message_at = now(), updated_at = now()
    WHERE id = ${input.conversationId} AND firm_id = ${input.firmId}
  `;
  const row = rows[0];
  return {
    id: row.id,
    conversationId: input.conversationId,
    firmId: input.firmId,
    role: "visitor",
    content: input.content,
    eveTurnId: input.eveTurnId,
    createdAt: row.created_at,
  };
}

export async function persistAssistantMessage(input: {
  conversationId: string;
  firmId: string;
  content: string;
  eveTurnId: string;
  finishReason?: string;
  metadata?: ConversationMetadata;
}): Promise<ConversationMessage | null> {
  const sql = getSql();
  const metadata: ConversationMetadata = {
    ...(input.metadata ?? {}),
    finishReason: input.finishReason ?? null,
  };
  const rows = toRows<{ id: string; created_at: string }>(await sql`
    INSERT INTO conversation_messages (conversation_id, firm_id, role, content, eve_turn_id, event_type, metadata)
    VALUES (
      ${input.conversationId},
      ${input.firmId},
      'assistant',
      ${input.content},
      ${input.eveTurnId},
      'message.completed',
      ${JSON.stringify(metadata)}
    )
    ON CONFLICT (conversation_id, eve_turn_id) WHERE eve_turn_id IS NOT NULL DO NOTHING
    RETURNING id, created_at
  `);
  if (!rows[0]) return null;

  await sql`
    UPDATE conversations
    SET last_message_at = now(), updated_at = now()
    WHERE id = ${input.conversationId} AND firm_id = ${input.firmId}
  `;

  return {
    id: rows[0].id,
    conversationId: input.conversationId,
    firmId: input.firmId,
    role: "assistant",
    content: input.content,
    eveTurnId: input.eveTurnId,
    createdAt: rows[0].created_at,
    metadata,
  };
}

export async function appendConversationEvent(input: {
  conversationId: string;
  firmId: string;
  eventType: string;
  payload?: Record<string, unknown>;
}): Promise<ConversationEvent> {
  await assertFirmConversation(input.firmId, input.conversationId);
  const sql = getSql();
  const rows = toRows<{ id: string; created_at: string }>(await sql`
    INSERT INTO conversation_events (conversation_id, firm_id, event_type, payload)
    VALUES (${input.conversationId}, ${input.firmId}, ${input.eventType}, ${JSON.stringify(input.payload ?? {})})
    RETURNING id, created_at
  `);
  return {
    id: rows[0]!.id,
    conversationId: input.conversationId,
    firmId: input.firmId,
    eventType: input.eventType,
    payload: input.payload ?? {},
    createdAt: rows[0]!.created_at,
  };
}

export async function updateConversationCursor(input: {
  conversationId: string;
  firmId: string;
  eveSessionId?: string;
  eveContinuationToken?: string;
  eveStreamIndex?: number;
}): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE conversations
    SET
      eve_session_id = COALESCE(${input.eveSessionId ?? null}, eve_session_id),
      eve_continuation_token = COALESCE(${input.eveContinuationToken ?? null}, eve_continuation_token),
      eve_stream_index = COALESCE(${input.eveStreamIndex ?? null}, eve_stream_index),
      updated_at = now()
    WHERE id = ${input.conversationId} AND firm_id = ${input.firmId}
  `;
}

export async function markConversationFailed(input: {
  conversationId: string;
  firmId: string;
  reason: string;
}): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE conversations
    SET status = 'failed',
        eve_session_id = NULL,
        eve_continuation_token = NULL,
        eve_stream_index = 0,
        updated_at = now()
    WHERE id = ${input.conversationId} AND firm_id = ${input.firmId}
  `;
  await appendConversationEvent({
    conversationId: input.conversationId,
    firmId: input.firmId,
    eventType: "session.failed",
    payload: { reason: input.reason },
  });
}

export async function markConversationFailedByEveSession(input: {
  eveSessionId: string;
  reason: string;
}): Promise<boolean> {
  const sql = getSql();
  const rows = toRows<{ id: string; firm_id: string }>(await sql`
    UPDATE conversations
    SET status = 'failed',
        eve_session_id = NULL,
        eve_continuation_token = NULL,
        eve_stream_index = 0,
        updated_at = now()
    WHERE eve_session_id = ${input.eveSessionId}
      AND status = 'open'
    RETURNING id, firm_id
  `);

  const conversation = rows[0];
  if (!conversation) return false;

  await appendConversationEvent({
    conversationId: conversation.id,
    firmId: conversation.firm_id,
    eventType: "session.failed",
    payload: { reason: input.reason },
  });
  return true;
}

export async function getConversationByEveSession(
  firmId: string,
  eveSessionId: string,
): Promise<Conversation | null> {
  const sql = getSql();
  const rows = toRows<ConversationRow>(await sql`
    SELECT id, firm_id, visitor_id, eve_session_id, eve_continuation_token, eve_stream_index,
           status, phase, source_url, firm_slug, matter_summary,
           primary_service_id, brain_snapshot, last_message_at, created_at, updated_at
    FROM conversations
    WHERE firm_id = ${firmId} AND eve_session_id = ${eveSessionId}
    LIMIT 1
  `);
  return rows[0] ? mapConversation(rows[0]) : null;
}

export async function listRecentConversations(input: {
  firmId: string;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<Array<Conversation & { messages: ConversationMessage[] }>> {
  const sql = getSql();
  const limit = input.limit ?? 50;

  const conversations = toRows<ConversationRow>(await sql`
    SELECT id, firm_id, visitor_id, eve_session_id, eve_continuation_token, eve_stream_index,
           status, phase, source_url, firm_slug, matter_summary,
           primary_service_id, brain_snapshot, last_message_at, created_at, updated_at
    FROM conversations
    WHERE firm_id = ${input.firmId}
      AND (${input.from ?? null}::timestamptz IS NULL OR created_at >= ${input.from ?? null}::timestamptz)
      AND (${input.to ?? null}::timestamptz IS NULL OR created_at <= ${input.to ?? null}::timestamptz)
    ORDER BY COALESCE(last_message_at, created_at) DESC
    LIMIT ${limit}
  `);

  const result: Array<Conversation & { messages: ConversationMessage[] }> = [];

  for (const conv of conversations) {
    const messages = toRows<{
      id: string;
      conversation_id: string;
      firm_id: string;
      role: string;
      content: string;
      eve_turn_id: string | null;
      created_at: string;
    }>(await sql`
      SELECT id, conversation_id, firm_id, role, content, eve_turn_id, created_at
      FROM conversation_messages
      WHERE conversation_id = ${conv.id} AND firm_id = ${input.firmId}
      ORDER BY created_at ASC
    `);

    result.push({
      ...mapConversation(conv),
      messages: messages.map((m) => ({
        id: m.id,
        conversationId: m.conversation_id,
        firmId: m.firm_id,
        role: m.role as ConversationMessage["role"],
        content: m.content,
        eveTurnId: m.eve_turn_id ?? undefined,
        createdAt: m.created_at,
      })),
    });
  }

  return result;
}

export async function resolveConversationContext(input: {
  firmId: string;
  firmSlug: string;
  eveSessionId: string;
  clientContext?: ClientContextInput;
}): Promise<Conversation> {
  const latestBrainSnapshot = await getFirmBrainSnapshotByFirmId(input.firmId);
  const visitor = await findOrCreateVisitor({
    firmId: input.firmId,
    anonymousKey: input.clientContext?.browserSessionId,
    source: "web",
  });

  const conversation = await findOrCreateConversation({
    firmId: input.firmId,
    firmSlug: input.firmSlug,
    visitorId: visitor.id,
    browserSessionId: input.clientContext?.browserSessionId,
    localConversationId: input.clientContext?.localConversationId,
    eveSessionId: input.eveSessionId,
    sourceUrl: input.clientContext?.sourceUrl,
  });

  if (latestBrainSnapshot && !conversation.brainSnapshot) {
    await ensureConversationBrainSnapshot({
      conversationId: conversation.id,
      firmId: input.firmId,
      brainSnapshot: latestBrainSnapshot,
    });
    return { ...conversation, brainSnapshot: latestBrainSnapshot };
  }

  return conversation;
}

export async function getChatHistoryByBrowserSession(input: {
  firmSlug: string;
  browserSessionId: string;
  conversationId?: string;
}): Promise<ChatHistoryResult> {
  const sql = getSql();
  const firms = toRows<{ id: string }>(await sql`
    SELECT id FROM firms WHERE slug = ${input.firmSlug} AND status = 'active' LIMIT 1
  `);
  const firmId = firms[0]?.id;
  if (!firmId) {
    return { found: false, messages: [] };
  }

  const conversations = input.conversationId
    ? toRows<ConversationRow>(await sql`
        SELECT c.id, c.firm_id, c.visitor_id, c.eve_session_id, c.eve_continuation_token, c.eve_stream_index,
               c.status, c.phase, c.source_url, c.firm_slug, c.matter_summary,
               c.primary_service_id, c.last_message_at, c.created_at, c.updated_at
        FROM conversations c
        WHERE c.id = ${input.conversationId}
          AND c.firm_id = ${firmId}
          AND c.status = 'open'
        LIMIT 1
      `)
    : toRows<ConversationRow>(await sql`
        SELECT c.id, c.firm_id, c.visitor_id, c.eve_session_id, c.eve_continuation_token, c.eve_stream_index,
               c.status, c.phase, c.source_url, c.firm_slug, c.matter_summary,
               c.primary_service_id, c.last_message_at, c.created_at, c.updated_at
        FROM conversations c
        JOIN visitors v ON v.id = c.visitor_id AND v.firm_id = c.firm_id
        WHERE c.firm_id = ${firmId}
          AND v.anonymous_key = ${input.browserSessionId}
          AND c.status = 'open'
        ORDER BY c.updated_at DESC
        LIMIT 1
      `);

  const conversation = conversations[0];
  if (!conversation) {
    return { found: false, messages: [] };
  }

  const messageRows = toRows<{
    id: string;
    conversation_id: string;
    firm_id: string;
    role: string;
    content: string;
    eve_turn_id: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
  }>(await sql`
    SELECT id, conversation_id, firm_id, role, content, eve_turn_id, metadata, created_at
    FROM conversation_messages
    WHERE conversation_id = ${conversation.id}
      AND firm_id = ${firmId}
      AND role IN ('visitor', 'assistant')
    ORDER BY created_at ASC
  `);

  const messages: ConversationMessage[] = messageRows.map((row) => ({
    id: row.id,
    conversationId: row.conversation_id,
    firmId: row.firm_id,
    role: row.role as ConversationMessage["role"],
    content: row.content,
    eveTurnId: row.eve_turn_id ?? undefined,
    metadata: row.metadata ? (row.metadata as ConversationMetadata) : undefined,
    createdAt: row.created_at,
  }));

  const sessionCursor =
    conversation.eve_session_id != null
      ? {
          sessionId: conversation.eve_session_id,
          continuationToken: conversation.eve_continuation_token ?? undefined,
          streamIndex: conversation.eve_stream_index ?? 0,
        }
      : undefined;

  return {
    found: true,
    conversationId: conversation.id,
    messages,
    sessionCursor,
  };
}

export async function deleteConversationByBrowserSession(input: {
  firmSlug: string;
  browserSessionId: string;
  conversationId?: string;
}): Promise<{ deleted: boolean; conversationId?: string }> {
  const sql = getSql();
  const firms = toRows<{ id: string }>(await sql`
    SELECT id FROM firms WHERE slug = ${input.firmSlug} AND status = 'active' LIMIT 1
  `);
  const firmId = firms[0]?.id;
  if (!firmId) {
    return { deleted: false };
  }

  const deleted = input.conversationId
    ? toRows<{ id: string }>(await sql`
        DELETE FROM conversations c
        WHERE c.id = ${input.conversationId}
          AND c.firm_id = ${firmId}
          AND c.status = 'open'
        RETURNING c.id
      `)
    : toRows<{ id: string }>(await sql`
        DELETE FROM conversations c
        USING visitors v
        WHERE c.visitor_id = v.id
          AND c.firm_id = v.firm_id
          AND c.firm_id = ${firmId}
          AND v.anonymous_key = ${input.browserSessionId}
          AND c.status = 'open'
        RETURNING c.id
      `);

  const conversationId = deleted[0]?.id;
  return conversationId ? { deleted: true, conversationId } : { deleted: false };
}

export async function updateConversationCursorByBrowserSession(input: {
  firmSlug: string;
  browserSessionId: string;
  conversationId?: string;
  sessionCursor: ConversationSessionCursor;
}): Promise<{ conversationId?: string }> {
  const sql = getSql();

  if (input.conversationId) {
    const rows = toRows<{ id: string }>(await sql`
      UPDATE conversations c
      SET
        eve_session_id = ${input.sessionCursor.sessionId ?? null},
        eve_continuation_token = ${input.sessionCursor.continuationToken ?? null},
        eve_stream_index = ${input.sessionCursor.streamIndex},
        updated_at = now()
      FROM firms f
      WHERE c.id = ${input.conversationId}
        AND c.firm_id = f.id
        AND f.slug = ${input.firmSlug}
        AND f.status = 'active'
        AND c.status = 'open'
      RETURNING c.id
    `);
    return { conversationId: rows[0]?.id };
  }

  const rows = toRows<{ id: string }>(await sql`
    UPDATE conversations c
    SET
      eve_session_id = ${input.sessionCursor.sessionId ?? null},
      eve_continuation_token = ${input.sessionCursor.continuationToken ?? null},
      eve_stream_index = ${input.sessionCursor.streamIndex},
      updated_at = now()
    FROM visitors v, firms f
    WHERE c.visitor_id = v.id
      AND c.firm_id = v.firm_id
      AND c.firm_id = f.id
      AND f.slug = ${input.firmSlug}
      AND f.status = 'active'
      AND v.anonymous_key = ${input.browserSessionId}
      AND c.status = 'open'
    RETURNING c.id
  `);
  return { conversationId: rows[0]?.id };
}

export async function clearConversationCursorByBrowserSession(input: {
  firmSlug: string;
  browserSessionId: string;
  conversationId?: string;
}): Promise<void> {
  const sql = getSql();

  if (input.conversationId) {
    await sql`
      UPDATE conversations c
      SET
        eve_session_id = NULL,
        eve_continuation_token = NULL,
        eve_stream_index = 0,
        updated_at = now()
      FROM firms f
      WHERE c.id = ${input.conversationId}
        AND c.firm_id = f.id
        AND f.slug = ${input.firmSlug}
        AND f.status = 'active'
        AND c.status = 'open'
    `;
    return;
  }

  await sql`
    UPDATE conversations c
    SET
      eve_session_id = NULL,
      eve_continuation_token = NULL,
      eve_stream_index = 0,
      updated_at = now()
    FROM visitors v, firms f
    WHERE c.visitor_id = v.id
      AND c.firm_id = v.firm_id
      AND c.firm_id = f.id
      AND f.slug = ${input.firmSlug}
      AND f.status = 'active'
      AND v.anonymous_key = ${input.browserSessionId}
      AND c.status = 'open'
  `;
}
