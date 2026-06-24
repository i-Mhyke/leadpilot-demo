import type { BookingRequest, LeadProfile, LeadScoreEvent, LeadScoreFactors, LeadTemperature } from "@leadpilot/shared";
import { getSql } from "./client.ts";
import {
  assertFirmLeadForConversation,
  assertFirmService,
  assertFirmVisitor,
} from "./firm-ownership.ts";
import { rows as toRows } from "./sql.ts";

type LeadRow = {
  id: string;
  firm_id: string;
  conversation_id: string;
  visitor_id: string | null;
  status: string;
  temperature: string;
  score: number;
  primary_service_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  summary: string | null;
  created_at: string;
  updated_at: string;
};

type BookingRow = {
  id: string;
  firm_id: string;
  conversation_id: string;
  lead_id: string | null;
  status: string;
  service_id: string | null;
  routing_group: string | null;
  visitor_name: string | null;
  visitor_email: string | null;
  visitor_phone: string | null;
  company_name: string | null;
  preferred_time_text: string | null;
  matter_summary: string;
  lead_brief: string;
  urgency: string | null;
  source_url: string | null;
  created_at: string;
  updated_at: string;
};

function mapLead(row: LeadRow): LeadProfile {
  return {
    id: row.id,
    firmId: row.firm_id,
    conversationId: row.conversation_id,
    visitorId: row.visitor_id ?? undefined,
    status: row.status as LeadProfile["status"],
    temperature: row.temperature as LeadTemperature,
    score: row.score,
    primaryServiceId: row.primary_service_id ?? undefined,
    name: row.name ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    companyName: row.company_name ?? undefined,
    summary: row.summary ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBooking(row: BookingRow): BookingRequest {
  return {
    id: row.id,
    firmId: row.firm_id,
    conversationId: row.conversation_id,
    leadId: row.lead_id ?? undefined,
    status: row.status as BookingRequest["status"],
    serviceId: row.service_id ?? undefined,
    routingGroup: row.routing_group ?? undefined,
    visitorName: row.visitor_name ?? undefined,
    visitorEmail: row.visitor_email ?? undefined,
    visitorPhone: row.visitor_phone ?? undefined,
    companyName: row.company_name ?? undefined,
    preferredTimeText: row.preferred_time_text ?? undefined,
    matterSummary: row.matter_summary,
    leadBrief: row.lead_brief,
    urgency: row.urgency ?? undefined,
    sourceUrl: row.source_url ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function upsertLeadProfile(input: {
  firmId: string;
  conversationId: string;
  visitorId?: string;
  name?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  summary?: string;
  primaryServiceId?: string;
  score: number;
  temperature: LeadTemperature;
  scoreFactors: LeadScoreFactors;
  reason: string;
  idempotencyKey?: string;
}): Promise<LeadProfile> {
  if (input.visitorId) {
    await assertFirmVisitor(input.firmId, input.visitorId);
  }
  if (input.primaryServiceId) {
    await assertFirmService(input.firmId, input.primaryServiceId);
  }

  const sql = getSql();

  const rows = toRows<LeadRow>(await sql`
    WITH upserted_lead AS (
      INSERT INTO lead_profiles (
        firm_id, conversation_id, visitor_id, status, temperature, score,
        primary_service_id, name, email, phone, company_name, summary
      )
      VALUES (
        ${input.firmId},
        ${input.conversationId},
        ${input.visitorId ?? null},
        'new',
        ${input.temperature},
        ${input.score},
        ${input.primaryServiceId ?? null},
        ${input.name ?? null},
        ${input.email ?? null},
        ${input.phone ?? null},
        ${input.companyName ?? null},
        ${input.summary ?? null}
      )
      ON CONFLICT (firm_id, conversation_id) DO UPDATE SET
        visitor_id = COALESCE(EXCLUDED.visitor_id, lead_profiles.visitor_id),
        temperature = EXCLUDED.temperature,
        score = EXCLUDED.score,
        primary_service_id = COALESCE(EXCLUDED.primary_service_id, lead_profiles.primary_service_id),
        name = COALESCE(EXCLUDED.name, lead_profiles.name),
        email = COALESCE(EXCLUDED.email, lead_profiles.email),
        phone = COALESCE(EXCLUDED.phone, lead_profiles.phone),
        company_name = COALESCE(EXCLUDED.company_name, lead_profiles.company_name),
        summary = COALESCE(EXCLUDED.summary, lead_profiles.summary),
        updated_at = now()
      RETURNING id, firm_id, conversation_id, visitor_id, status, temperature, score,
                primary_service_id, name, email, phone, company_name, summary, created_at, updated_at
    ),
    _score_event AS (
      INSERT INTO lead_score_events (
        lead_id, conversation_id, firm_id, score, temperature, factors, reason, idempotency_key
      )
      SELECT
        upserted_lead.id,
        ${input.conversationId},
        ${input.firmId},
        ${input.score},
        ${input.temperature},
        ${JSON.stringify(input.scoreFactors)},
        ${input.reason},
        ${input.idempotencyKey ?? null}
      FROM upserted_lead
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING id
    )
    SELECT * FROM upserted_lead
  `);

  return mapLead(rows[0]!);
}

export async function findOpenBookingRequest(
  firmId: string,
  conversationId: string,
): Promise<BookingRequest | null> {
  const sql = getSql();
  const rows = toRows<BookingRow>(await sql`
    SELECT id, firm_id, conversation_id, lead_id, status, service_id, routing_group,
           visitor_name, visitor_email, visitor_phone, company_name, preferred_time_text,
           matter_summary, lead_brief, urgency, source_url, created_at, updated_at
    FROM booking_requests
    WHERE firm_id = ${firmId}
      AND conversation_id = ${conversationId}
      AND status = 'requested'
    ORDER BY created_at DESC
    LIMIT 1
  `);
  return rows[0] ? mapBooking(rows[0]) : null;
}

export async function createBookingRequest(input: {
  firmId: string;
  conversationId: string;
  leadId?: string;
  visitorId?: string;
  serviceId?: string;
  routingGroup?: string;
  visitorName?: string;
  visitorEmail?: string;
  visitorPhone?: string;
  companyName?: string;
  preferredTimeText?: string;
  matterSummary: string;
  leadBrief: string;
  urgency?: string;
  sourceUrl?: string;
  idempotencyKey?: string;
}): Promise<BookingRequest> {
  if (input.leadId) {
    await assertFirmLeadForConversation(input.firmId, input.conversationId, input.leadId);
  }
  if (input.visitorId) {
    await assertFirmVisitor(input.firmId, input.visitorId);
  }
  if (input.serviceId) {
    await assertFirmService(input.firmId, input.serviceId);
  }

  const existing = await findOpenBookingRequest(input.firmId, input.conversationId);
  if (existing) {
    return mergeOpenBookingRequest(existing, input);
  }

  if (!input.leadId) {
    throw new Error("leadId is required when creating a new booking request.");
  }

  const sql = getSql();
  try {
    const rows = toRows<BookingRow>(await sql`
      INSERT INTO booking_requests (
        firm_id, conversation_id, lead_id, visitor_id, status, service_id, routing_group,
        visitor_name, visitor_email, visitor_phone, company_name, preferred_time_text,
        matter_summary, lead_brief, urgency, source_url, idempotency_key
      )
      VALUES (
        ${input.firmId},
        ${input.conversationId},
        ${input.leadId ?? null},
        ${input.visitorId ?? null},
        'requested',
        ${input.serviceId ?? null},
        ${input.routingGroup ?? null},
        ${input.visitorName ?? null},
        ${input.visitorEmail ?? null},
        ${input.visitorPhone ?? null},
        ${input.companyName ?? null},
        ${input.preferredTimeText ?? null},
        ${input.matterSummary},
        ${input.leadBrief},
        ${input.urgency ?? null},
        ${input.sourceUrl ?? null},
        ${input.idempotencyKey ?? null}
      )
      RETURNING id, firm_id, conversation_id, lead_id, status, service_id, routing_group,
                visitor_name, visitor_email, visitor_phone, company_name, preferred_time_text,
                matter_summary, lead_brief, urgency, source_url, created_at, updated_at
    `);
    return mapBooking(rows[0]!);
  } catch (error) {
    const existingAfterRace = await findOpenBookingRequest(input.firmId, input.conversationId);
    if (existingAfterRace) {
      return mergeOpenBookingRequest(existingAfterRace, input);
    }
    throw error;
  }
}

function mergeOpenBookingRequest(
  existing: BookingRequest,
  input: {
    leadId?: string;
    visitorId?: string;
    serviceId?: string;
    routingGroup?: string;
    visitorName?: string;
    visitorEmail?: string;
    visitorPhone?: string;
    companyName?: string;
    preferredTimeText?: string;
    matterSummary: string;
    leadBrief: string;
    urgency?: string;
    sourceUrl?: string;
  },
): Promise<BookingRequest> {
  const merged = {
    leadId: existing.leadId ?? input.leadId,
    visitorPhone: input.visitorPhone ?? existing.visitorPhone,
    preferredTimeText: input.preferredTimeText ?? existing.preferredTimeText,
    companyName: input.companyName ?? existing.companyName,
    visitorName: input.visitorName ?? existing.visitorName,
    visitorEmail: input.visitorEmail ?? existing.visitorEmail,
    matterSummary: input.matterSummary || existing.matterSummary,
    leadBrief: input.leadBrief || existing.leadBrief,
    urgency: input.urgency ?? existing.urgency,
    serviceId: input.serviceId ?? existing.serviceId,
    routingGroup: input.routingGroup ?? existing.routingGroup,
    sourceUrl: input.sourceUrl ?? existing.sourceUrl,
  };

  const changed =
    merged.leadId !== existing.leadId ||
    merged.visitorPhone !== existing.visitorPhone ||
    merged.preferredTimeText !== existing.preferredTimeText ||
    merged.companyName !== existing.companyName ||
    merged.visitorName !== existing.visitorName ||
    merged.visitorEmail !== existing.visitorEmail ||
    merged.matterSummary !== existing.matterSummary ||
    merged.leadBrief !== existing.leadBrief ||
    merged.urgency !== existing.urgency ||
    merged.serviceId !== existing.serviceId ||
    merged.routingGroup !== existing.routingGroup ||
    merged.sourceUrl !== existing.sourceUrl;

  if (!changed) return Promise.resolve(existing);

  return updateOpenBookingRequest(existing.id, existing.firmId, merged);
}

async function updateOpenBookingRequest(
  bookingId: string,
  firmId: string,
  patch: {
    leadId?: string;
    visitorPhone?: string;
    preferredTimeText?: string;
    companyName?: string;
    visitorName?: string;
    visitorEmail?: string;
    matterSummary: string;
    leadBrief: string;
    urgency?: string;
    serviceId?: string;
    routingGroup?: string;
    sourceUrl?: string;
  },
): Promise<BookingRequest> {
  const sql = getSql();
  const rows = toRows<BookingRow>(await sql`
    UPDATE booking_requests
    SET
      lead_id = ${patch.leadId ?? null},
      visitor_phone = ${patch.visitorPhone ?? null},
      preferred_time_text = ${patch.preferredTimeText ?? null},
      company_name = ${patch.companyName ?? null},
      visitor_name = ${patch.visitorName ?? null},
      visitor_email = ${patch.visitorEmail ?? null},
      matter_summary = ${patch.matterSummary},
      lead_brief = ${patch.leadBrief},
      urgency = ${patch.urgency ?? null},
      service_id = ${patch.serviceId ?? null},
      routing_group = ${patch.routingGroup ?? null},
      source_url = ${patch.sourceUrl ?? null},
      updated_at = now()
    WHERE id = ${bookingId}
      AND firm_id = ${firmId}
      AND status = 'requested'
    RETURNING id, firm_id, conversation_id, lead_id, status, service_id, routing_group,
              visitor_name, visitor_email, visitor_phone, company_name, preferred_time_text,
              matter_summary, lead_brief, urgency, source_url, created_at, updated_at
  `);
  return mapBooking(rows[0]!);
}

export async function appendLeadScoreEvent(input: {
  leadId: string;
  conversationId: string;
  firmId: string;
  score: number;
  temperature: LeadTemperature;
  factors: LeadScoreFactors;
  reason: string;
  createdBy?: string;
}): Promise<LeadScoreEvent> {
  const sql = getSql();
  const rows = toRows<{ id: string; created_at: string }>(await sql`
    INSERT INTO lead_score_events (lead_id, conversation_id, firm_id, score, temperature, factors, reason, created_by)
    VALUES (
      ${input.leadId},
      ${input.conversationId},
      ${input.firmId},
      ${input.score},
      ${input.temperature},
      ${JSON.stringify(input.factors)},
      ${input.reason},
      ${input.createdBy ?? "agent"}
    )
    RETURNING id, created_at
  `);
  return {
    id: rows[0]!.id,
    leadId: input.leadId,
    conversationId: input.conversationId,
    firmId: input.firmId,
    score: input.score,
    temperature: input.temperature,
    factors: input.factors,
    reason: input.reason,
    createdBy: input.createdBy ?? "agent",
    createdAt: rows[0]!.created_at,
  };
}
