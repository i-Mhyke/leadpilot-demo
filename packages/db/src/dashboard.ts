import {
  CONVERSATION_CONTEXT_PREVIEW_LIMIT,
  type BookingRequestItem,
  type ConversationContextMessage,
  type FirmBookingDetail,
  type FirmBookingDetailResult,
  type FirmBookingRequestsResult,
  type FirmConversationLead,
  type FirmConversationLeadsResult,
  type FirmDashboardOverview,
  type FirmDashboardResult,
} from "@leadpilot/shared";
import { getSql } from "./client.ts";
import { assertFirmConversation } from "./firm-ownership.ts";
import { getFirmBySlug } from "./firms.ts";
import { rows as toRows } from "./sql.ts";

export { CONVERSATION_CONTEXT_PREVIEW_LIMIT } from "@leadpilot/shared";

type ConversationSummaryRow = {
  id: string;
  matter_summary: string | null;
  phase: string;
  status: string;
  last_message_at: string | null;
  created_at: string;
};

type TopicRow = {
  topic: string;
  topic_count: string;
};

export async function getFirmDashboardOverviewBySlug(slug: string): Promise<FirmDashboardResult> {
  const firm = await getFirmBySlug(slug);
  if ("kind" in firm) {
    return firm.kind === "inactive" ? { kind: "inactive", slug } : { kind: "not_found", slug };
  }

  const sql = getSql();
  const firmId = firm.id;

  const [
    conversationsTotalRows,
    conversationsTodayRows,
    newLeadsRows,
    bookingRequestRows,
    topicRows,
    conversationRows,
  ] = await Promise.all([
    sql`SELECT COUNT(*)::text AS count FROM conversations WHERE firm_id = ${firmId}`,
    sql`
      SELECT COUNT(*)::text AS count
      FROM conversations
      WHERE firm_id = ${firmId}
        AND created_at >= date_trunc('day', now())
    `,
    sql`
      SELECT COUNT(*)::text AS count
      FROM lead_profiles
      WHERE firm_id = ${firmId} AND status = 'new'
    `,
    sql`
      SELECT COUNT(*)::text AS count
      FROM booking_requests
      WHERE firm_id = ${firmId} AND status = 'requested'
    `,
    sql`
      SELECT topic, COUNT(*)::text AS topic_count
      FROM conversation_topics
      WHERE firm_id = ${firmId}
      GROUP BY topic
      ORDER BY COUNT(*) DESC, topic ASC
      LIMIT 5
    `,
    sql`
      SELECT id, matter_summary, phase, status, last_message_at, created_at
      FROM conversations
      WHERE firm_id = ${firmId}
      ORDER BY COALESCE(last_message_at, created_at) DESC
      LIMIT 10
    `,
  ]);

  const overview: FirmDashboardOverview = {
    firm,
    metrics: {
      conversationsTotal: Number(toRows<{ count: string }>(conversationsTotalRows)[0]?.count ?? 0),
      conversationsToday: Number(toRows<{ count: string }>(conversationsTodayRows)[0]?.count ?? 0),
      newLeads: Number(toRows<{ count: string }>(newLeadsRows)[0]?.count ?? 0),
      bookingRequests: Number(toRows<{ count: string }>(bookingRequestRows)[0]?.count ?? 0),
      recentTopics: toRows<TopicRow>(topicRows).map((row) => ({
        topic: row.topic,
        count: Number(row.topic_count),
      })),
    },
    recentConversations: toRows<ConversationSummaryRow>(conversationRows).map((row) => ({
      id: row.id,
      matterSummary: row.matter_summary ?? undefined,
      phase: row.phase as FirmDashboardOverview["recentConversations"][number]["phase"],
      status: row.status as FirmDashboardOverview["recentConversations"][number]["status"],
      lastMessageAt: row.last_message_at ?? undefined,
      createdAt: row.created_at,
    })),
  };

  return { kind: "ok", overview };
}

type ConversationLeadRow = {
  conversation_id: string;
  visitor_id: string;
  visitor_name: string | null;
  visitor_email: string | null;
  visitor_phone: string | null;
  company_name: string | null;
  anonymous_key: string | null;
  matter_summary: string | null;
  phase: string;
  status: string;
  source_url: string | null;
  last_message_at: string | null;
  created_at: string;
  message_count: string;
  topics: string[] | null;
  lead_status: string | null;
  lead_temperature: string | null;
  lead_score: number | null;
  lead_summary: string | null;
  booking_status: string | null;
  preferred_booking_at: string | null;
};

function visitorLabel(row: ConversationLeadRow): string {
  if (row.visitor_name?.trim()) return row.visitor_name.trim();
  if (row.visitor_email?.trim()) return row.visitor_email.trim();
  if (row.anonymous_key?.trim()) {
    return `Visitor ${row.anonymous_key.slice(0, 8)}`;
  }
  return `Visitor ${row.visitor_id.slice(0, 8)}`;
}

export async function listFirmConversationLeadsBySlug(
  slug: string,
  limit = 100,
): Promise<FirmConversationLeadsResult> {
  const firm = await getFirmBySlug(slug);
  if ("kind" in firm) {
    return firm.kind === "inactive" ? { kind: "inactive", slug } : { kind: "not_found", slug };
  }

  const sql = getSql();
  const rows = toRows<ConversationLeadRow>(await sql`
    SELECT
      c.id AS conversation_id,
      c.visitor_id,
      v.name AS visitor_name,
      v.email AS visitor_email,
      v.phone AS visitor_phone,
      v.company_name,
      v.anonymous_key,
      c.matter_summary,
      c.phase,
      c.status,
      c.source_url,
      c.last_message_at,
      c.created_at,
      (
        SELECT COUNT(*)::text
        FROM conversation_messages cm
        WHERE cm.conversation_id = c.id AND cm.firm_id = c.firm_id
      ) AS message_count,
      (
        SELECT ARRAY_AGG(DISTINCT ct.topic ORDER BY ct.topic)
        FROM conversation_topics ct
        WHERE ct.conversation_id = c.id AND ct.firm_id = c.firm_id
      ) AS topics,
      lp.status AS lead_status,
      lp.temperature AS lead_temperature,
      lp.score AS lead_score,
      lp.summary AS lead_summary,
      br.status AS booking_status,
      COALESCE(br.preferred_booking_at, be.preferred_booking_at) AS preferred_booking_at
    FROM conversations c
    INNER JOIN visitors v ON v.id = c.visitor_id AND v.firm_id = c.firm_id
    LEFT JOIN lead_profiles lp ON lp.conversation_id = c.id AND lp.firm_id = c.firm_id
    LEFT JOIN LATERAL (
      SELECT status,
             preferred_booking_at
      FROM booking_requests
      WHERE conversation_id = c.id AND firm_id = c.firm_id
      ORDER BY created_at DESC
      LIMIT 1
    ) br ON true
    LEFT JOIN LATERAL (
      SELECT (payload->>'preferredBookingAt')::timestamptz AS preferred_booking_at
      FROM conversation_events
      WHERE conversation_id = c.id
        AND firm_id = c.firm_id
        AND event_type = 'booking.preferred_datetime_selected'
      ORDER BY created_at DESC
      LIMIT 1
    ) be ON true
    WHERE c.firm_id = ${firm.id}
    ORDER BY COALESCE(c.last_message_at, c.created_at) DESC
    LIMIT ${limit}
  `);

  const leads: FirmConversationLead[] = rows.map((row) => ({
    conversationId: row.conversation_id,
    visitorId: row.visitor_id,
    visitorLabel: visitorLabel(row),
    visitorName: row.visitor_name?.trim() || undefined,
    visitorEmail: row.visitor_email ?? undefined,
    visitorPhone: row.visitor_phone ?? undefined,
    companyName: row.company_name ?? undefined,
    matterSummary: row.matter_summary ?? undefined,
    phase: row.phase as FirmConversationLead["phase"],
    status: row.status as FirmConversationLead["status"],
    sourceUrl: row.source_url ?? undefined,
    lastMessageAt: row.last_message_at ?? undefined,
    createdAt: row.created_at,
    messageCount: Number(row.message_count),
    topics: row.topics ?? [],
    lead:
      row.lead_status && row.lead_temperature != null && row.lead_score != null
        ? {
            status: row.lead_status as "new" | "contacted" | "converted" | "archived",
            temperature: row.lead_temperature as "cold" | "warm" | "hot",
            score: row.lead_score,
            summary: row.lead_summary ?? undefined,
          }
        : undefined,
    preferredBookingAt: row.preferred_booking_at ?? undefined,
    bookingStatus: row.booking_status
      ? (row.booking_status as FirmConversationLead["bookingStatus"])
      : undefined,
  }));

  return { kind: "ok", leads };
}

type BookingListRow = {
  id: string;
  conversation_id: string;
  status: string;
  visitor_name: string | null;
  visitor_email: string | null;
  visitor_phone: string | null;
  company_name: string | null;
  preferred_booking_at: string | null;
  matter_summary: string;
  lead_brief: string;
  preferred_time_text: string | null;
  urgency: string | null;
  created_at: string;
};

type BookingDetailRow = BookingListRow & {
  firm_id: string;
  lead_id: string | null;
  service_id: string | null;
  routing_group: string | null;
  source_url: string | null;
  updated_at: string;
};

type LeadDetailRow = {
  status: string;
  temperature: string;
  score: number;
  summary: string | null;
};

type MessagePreviewRow = {
  id: string;
  role: string;
  content: string;
  created_at: string;
};

function mapBookingListItem(row: BookingListRow): BookingRequestItem {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    status: row.status as BookingRequestItem["status"],
    visitorName: row.visitor_name ?? undefined,
    visitorEmail: row.visitor_email ?? undefined,
    visitorPhone: row.visitor_phone ?? undefined,
    companyName: row.company_name ?? undefined,
    preferredBookingAt: row.preferred_booking_at ?? undefined,
    matterSummary: row.matter_summary,
    leadBrief: row.lead_brief,
    preferredTimeText: row.preferred_time_text ?? undefined,
    urgency: row.urgency ?? undefined,
    createdAt: row.created_at,
  };
}

function mapBookingDetail(row: BookingDetailRow) {
  return {
    id: row.id,
    firmId: row.firm_id,
    conversationId: row.conversation_id,
    leadId: row.lead_id ?? undefined,
    status: row.status as FirmBookingDetail["booking"]["status"],
    serviceId: row.service_id ?? undefined,
    routingGroup: row.routing_group ?? undefined,
    visitorName: row.visitor_name ?? undefined,
    visitorEmail: row.visitor_email ?? undefined,
    visitorPhone: row.visitor_phone ?? undefined,
    companyName: row.company_name ?? undefined,
    preferredBookingAt: row.preferred_booking_at ?? undefined,
    preferredTimeText: row.preferred_time_text ?? undefined,
    matterSummary: row.matter_summary,
    leadBrief: row.lead_brief,
    urgency: row.urgency ?? undefined,
    sourceUrl: row.source_url ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listFirmBookingRequestItemsBySlug(
  slug: string,
  limit = 20,
): Promise<FirmBookingRequestsResult> {
  const firm = await getFirmBySlug(slug);
  if ("kind" in firm) {
    return firm.kind === "inactive" ? { kind: "inactive", slug } : { kind: "not_found", slug };
  }

  const sql = getSql();
  const rows = toRows<BookingListRow>(await sql`
    SELECT
      br0.id,
      br0.conversation_id,
      br0.status,
      br0.visitor_name,
      br0.visitor_email,
      br0.visitor_phone,
      br0.company_name,
      COALESCE(br0.preferred_booking_at, be.preferred_booking_at) AS preferred_booking_at,
      br0.matter_summary,
      br0.lead_brief,
      br0.preferred_time_text,
      br0.urgency,
      br0.created_at
    FROM booking_requests br0
    LEFT JOIN LATERAL (
      SELECT (payload->>'preferredBookingAt')::timestamptz AS preferred_booking_at
      FROM conversation_events
      WHERE conversation_id = br0.conversation_id
        AND firm_id = br0.firm_id
        AND event_type = 'booking.preferred_datetime_selected'
      ORDER BY created_at DESC
      LIMIT 1
    ) be ON true
    WHERE firm_id = ${firm.id}
    ORDER BY br0.created_at DESC
    LIMIT ${limit}
  `);

  return { kind: "ok", bookings: rows.map(mapBookingListItem) };
}

export async function getFirmBookingDetailBySlug(
  slug: string,
  conversationId: string,
): Promise<FirmBookingDetailResult> {
  const firm = await getFirmBySlug(slug);
  if ("kind" in firm) {
    return firm.kind === "inactive" ? { kind: "inactive", slug } : { kind: "not_found", slug };
  }

  try {
    await assertFirmConversation(firm.id, conversationId);
  } catch {
    return { kind: "not_found_booking", conversationId };
  }

  const sql = getSql();
  const bookingRows = toRows<BookingDetailRow>(await sql`
    SELECT
      br0.id,
      br0.firm_id,
      br0.conversation_id,
      br0.lead_id,
      br0.status,
      br0.service_id,
      br0.routing_group,
      br0.visitor_name,
      br0.visitor_email,
      br0.visitor_phone,
      br0.company_name,
      COALESCE(br0.preferred_booking_at, be.preferred_booking_at) AS preferred_booking_at,
      br0.preferred_time_text,
      br0.matter_summary,
      br0.lead_brief,
      br0.urgency,
      br0.source_url,
      br0.created_at,
      br0.updated_at
    FROM booking_requests br0
    LEFT JOIN LATERAL (
      SELECT (payload->>'preferredBookingAt')::timestamptz AS preferred_booking_at
      FROM conversation_events
      WHERE conversation_id = br0.conversation_id
        AND firm_id = br0.firm_id
        AND event_type = 'booking.preferred_datetime_selected'
      ORDER BY created_at DESC
      LIMIT 1
    ) be ON true
    WHERE firm_id = ${firm.id}
      AND conversation_id = ${conversationId}
    ORDER BY br0.created_at DESC
    LIMIT 1
  `);

  const bookingRow = bookingRows[0];
  if (!bookingRow) {
    return { kind: "not_found_booking", conversationId };
  }

  const [leadRows, messageCountRows, messageRows] = await Promise.all([
    sql`
      SELECT status, temperature, score, summary
      FROM lead_profiles
      WHERE firm_id = ${firm.id}
        AND conversation_id = ${conversationId}
      LIMIT 1
    `,
    sql`
      SELECT COUNT(*)::text AS count
      FROM conversation_messages
      WHERE firm_id = ${firm.id}
        AND conversation_id = ${conversationId}
        AND role IN ('visitor', 'assistant')
    `,
    sql`
      SELECT id, role, content, created_at
      FROM conversation_messages
      WHERE firm_id = ${firm.id}
        AND conversation_id = ${conversationId}
        AND role IN ('visitor', 'assistant')
      ORDER BY created_at DESC
      LIMIT ${CONVERSATION_CONTEXT_PREVIEW_LIMIT}
    `,
  ]);

  const leadRow = toRows<LeadDetailRow>(leadRows)[0];
  const messageCount = Number(toRows<{ count: string }>(messageCountRows)[0]?.count ?? 0);
  const messages = toRows<MessagePreviewRow>(messageRows)
    .reverse()
    .map(
      (row): ConversationContextMessage => ({
        id: row.id,
        role: row.role as ConversationContextMessage["role"],
        content: row.content,
        createdAt: row.created_at,
      }),
    );

  const detail: FirmBookingDetail = {
    conversationId,
    booking: mapBookingDetail(bookingRow),
    lead: leadRow
      ? {
          status: leadRow.status as "new" | "contacted" | "converted" | "archived",
          temperature: leadRow.temperature as "cold" | "warm" | "hot",
          score: leadRow.score,
          summary: leadRow.summary ?? undefined,
        }
      : undefined,
    messages,
    messageCount,
  };

  return { kind: "ok", detail };
}
