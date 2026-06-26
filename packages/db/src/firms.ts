import type {
  Firm,
  FirmAgentProfile,
  FirmBookingPolicy,
  FirmPricingPolicy,
  FirmService,
  FirmToneProfile,
} from "@leadpilot/shared";
import { getSql } from "./client.ts";
import { buildFirmDeletionStatements } from "./firm-deletion.ts";
import { rows as toRows } from "./sql.ts";

export type FirmNotFound = { kind: "not_found"; slug: string };
export type FirmInactive = { kind: "inactive"; slug: string };

type FirmRow = {
  id: string;
  name: string;
  slug: string;
  industry: string;
  jurisdiction: string | null;
  website_url: string | null;
  status: string;
};

type ServiceRow = {
  id: string;
  firm_id: string;
  name: string;
  slug: string;
  description: string;
  visitor_examples: string[];
  qualification_questions: string[];
  urgency_signals: string[];
  required_booking_fields: string[];
  routing_group: string | null;
  is_active: boolean;
};

type BookingPolicyRow = {
  booking_mode: string;
  contact_capture_threshold: number;
  booking_offer_threshold: number;
  required_contact_fields: string[];
  allow_phone_capture: boolean;
};

type PricingPolicyRow = {
  can_discuss_fees: boolean;
  fee_summary: string | null;
  fee_disclaimer: string | null;
  requires_human_for_fee_questions: boolean;
};

type ToneRow = {
  voice: string;
  formality_level: string;
  preferred_greeting: string | null;
  avoid_phrases: string[];
  signature_disclaimer: string | null;
};

type FirmSlugRow = {
  slug: string;
};

type FirmAdminDirectoryRow = FirmRow & {
  conversations_total: string;
  ask_page_visits: string;
  dashboard_page_visits: string;
  last_visit_at: string | null;
};

export interface FirmAdminDirectoryItem {
  firm: Firm;
  conversationsTotal: number;
  askPageVisits: number;
  dashboardPageVisits: number;
  lastVisitAt?: string;
}

function mapFirm(row: FirmRow): Firm {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    industry: row.industry as Firm["industry"],
    jurisdiction: row.jurisdiction ?? undefined,
    websiteUrl: row.website_url ?? undefined,
    status: row.status as Firm["status"],
  };
}

function normalizeFirmName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function slugifyFirmName(name: string): string {
  const normalized = normalizeFirmName(name).normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  return normalized
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

async function getActiveFirmByIdentity(
  name: string,
  industry: Firm["industry"],
  jurisdiction: string,
): Promise<Firm | null> {
  const sql = getSql();
  const rows = toRows<FirmRow>(await sql`
    SELECT id, name, slug, industry, jurisdiction, website_url, status
    FROM firms
    WHERE lower(name) = lower(${name})
      AND industry = ${industry}
      AND lower(coalesce(jurisdiction, '')) = lower(${jurisdiction})
      AND status = 'active'
    LIMIT 1
  `);
  const row = rows[0];
  return row ? mapFirm(row) : null;
}

async function getFirmSlugsWithPrefix(baseSlug: string): Promise<Set<string>> {
  const sql = getSql();
  const rows = toRows<FirmSlugRow>(await sql`
    SELECT slug
    FROM firms
    WHERE slug = ${baseSlug} OR slug LIKE ${`${baseSlug}-%`}
  `);
  return new Set(rows.map((row) => row.slug));
}

function pickAvailableSlug(baseSlug: string, usedSlugs: Set<string>): string {
  if (!usedSlugs.has(baseSlug)) return baseSlug;

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${baseSlug}-${suffix}`;
    if (!usedSlugs.has(candidate)) return candidate;
  }

  throw new Error(`Unable to allocate a unique slug for "${baseSlug}".`);
}

function mapService(row: ServiceRow): FirmService {
  return {
    id: row.id,
    firmId: row.firm_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    visitorExamples: row.visitor_examples ?? [],
    qualificationQuestions: row.qualification_questions ?? [],
    urgencySignals: row.urgency_signals ?? [],
    requiredBookingFields: row.required_booking_fields ?? [],
    routingGroup: row.routing_group ?? undefined,
    isActive: row.is_active,
  };
}

const DEFAULT_BOOKING_POLICY: FirmBookingPolicy = {
  bookingMode: "request_only",
  contactCaptureThreshold: 55,
  bookingOfferThreshold: 70,
  requiredContactFields: ["name", "email", "matter_summary"],
  allowPhoneCapture: true,
};

const DEFAULT_PRICING_POLICY: FirmPricingPolicy = {
  canDiscussFees: false,
  requiresHumanForFeeQuestions: true,
};

const DEFAULT_TONE: FirmToneProfile = {
  voice: "warm_professional",
  formalityLevel: "balanced",
  avoidPhrases: [],
};

export async function getFirmBySlug(
  slug: string,
): Promise<Firm | FirmNotFound | FirmInactive> {
  const row = await getFirmRecordBySlug(slug);
  if (!row) return { kind: "not_found", slug };
  if (row.status !== "active") return { kind: "inactive", slug };
  return mapFirm(row);
}

async function getFirmRecordBySlug(slug: string): Promise<FirmRow | null> {
  const sql = getSql();
  const rows = toRows<FirmRow>(await sql`
    SELECT id, name, slug, industry, jurisdiction, website_url, status
    FROM firms
    WHERE slug = ${slug}
    LIMIT 1
  `);
  return rows[0] ?? null;
}

export async function getFirmBookingPolicy(firmId: string): Promise<FirmBookingPolicy> {
  const sql = getSql();
  const rows = toRows<BookingPolicyRow>(await sql`
    SELECT booking_mode, contact_capture_threshold, booking_offer_threshold,
           required_contact_fields, allow_phone_capture
    FROM firm_booking_policies
    WHERE firm_id = ${firmId}
    LIMIT 1
  `);
  const row = rows[0];
  if (!row) return DEFAULT_BOOKING_POLICY;
  return {
    bookingMode: row.booking_mode as FirmBookingPolicy["bookingMode"],
    contactCaptureThreshold: row.contact_capture_threshold,
    bookingOfferThreshold: row.booking_offer_threshold,
    requiredContactFields: row.required_contact_fields ?? DEFAULT_BOOKING_POLICY.requiredContactFields,
    allowPhoneCapture: row.allow_phone_capture,
  };
}

export async function getFirmPricingPolicy(firmId: string): Promise<FirmPricingPolicy> {
  const sql = getSql();
  const rows = toRows<PricingPolicyRow>(await sql`
    SELECT can_discuss_fees, fee_summary, fee_disclaimer, requires_human_for_fee_questions
    FROM firm_pricing_policies
    WHERE firm_id = ${firmId}
    LIMIT 1
  `);
  const row = rows[0];
  if (!row) return DEFAULT_PRICING_POLICY;
  return {
    canDiscussFees: row.can_discuss_fees,
    feeSummary: row.fee_summary ?? undefined,
    feeDisclaimer: row.fee_disclaimer ?? undefined,
    requiresHumanForFeeQuestions: row.requires_human_for_fee_questions,
  };
}

export async function getFirmToneProfile(firmId: string): Promise<FirmToneProfile> {
  const sql = getSql();
  const rows = toRows<ToneRow>(await sql`
    SELECT voice, formality_level, preferred_greeting, avoid_phrases, signature_disclaimer
    FROM firm_agent_tone_profiles
    WHERE firm_id = ${firmId}
    LIMIT 1
  `);
  const row = rows[0];
  if (!row) return DEFAULT_TONE;
  return {
    voice: row.voice,
    formalityLevel: row.formality_level,
    preferredGreeting: row.preferred_greeting ?? undefined,
    avoidPhrases: row.avoid_phrases ?? [],
    signatureDisclaimer: row.signature_disclaimer ?? undefined,
  };
}

export async function listActiveFirmServices(firmId: string): Promise<FirmService[]> {
  const sql = getSql();
  const rows = toRows<ServiceRow>(await sql`
    SELECT id, firm_id, name, slug, description, visitor_examples, qualification_questions,
           urgency_signals, required_booking_fields, routing_group, is_active
    FROM firm_services
    WHERE firm_id = ${firmId} AND is_active = true
    ORDER BY name ASC
  `);
  return rows.map(mapService);
}

export async function listActiveFirms(): Promise<Firm[]> {
  const sql = getSql();
  const rows = toRows<FirmRow>(await sql`
    SELECT id, name, slug, industry, jurisdiction, website_url, status
    FROM firms
    WHERE status = 'active'
    ORDER BY name ASC
  `);
  return rows.map(mapFirm);
}

export async function listFirmAdminDirectory(input: {
  country?: string;
  sector?: Firm["industry"];
} = {}): Promise<FirmAdminDirectoryItem[]> {
  const sql = getSql();
  const rows = toRows<FirmAdminDirectoryRow>(await sql`
    SELECT
      f.id,
      f.name,
      f.slug,
      f.industry,
      f.jurisdiction,
      f.website_url,
      f.status,
      COALESCE((
        SELECT COUNT(*)::text
        FROM conversations c
        WHERE c.firm_id = f.id
      ), '0') AS conversations_total,
      COALESCE((
        SELECT COUNT(*)::text
        FROM firm_page_visits v
        WHERE v.firm_id = f.id
          AND v.page_key = 'ask'
      ), '0') AS ask_page_visits,
      COALESCE((
        SELECT COUNT(*)::text
        FROM firm_page_visits v
        WHERE v.firm_id = f.id
          AND v.page_key = 'dashboard'
      ), '0') AS dashboard_page_visits,
      (
        SELECT MAX(v.created_at)
        FROM firm_page_visits v
        WHERE v.firm_id = f.id
      ) AS last_visit_at
    FROM firms f
    WHERE f.status = 'active'
      AND (${input.country ?? null}::text IS NULL OR f.jurisdiction = ${input.country ?? null})
      AND (${input.sector ?? null}::text IS NULL OR f.industry = ${input.sector ?? null})
    ORDER BY f.name ASC
  `);

  return rows.map((row) => ({
    firm: mapFirm(row),
    conversationsTotal: Number(row.conversations_total ?? 0),
    askPageVisits: Number(row.ask_page_visits ?? 0),
    dashboardPageVisits: Number(row.dashboard_page_visits ?? 0),
    lastVisitAt: row.last_visit_at ?? undefined,
  }));
}

export async function recordFirmPageVisit(input: {
  firmId: string;
  pageKey: "ask" | "dashboard";
}): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO firm_page_visits (firm_id, page_key)
    VALUES (${input.firmId}, ${input.pageKey})
  `;
}

export async function getFirmProfile(firmId: string): Promise<FirmAgentProfile | null> {
  const sql = getSql();
  const rows = toRows<FirmRow>(await sql`
    SELECT id, name, slug, industry, jurisdiction, website_url, status
    FROM firms
    WHERE id = ${firmId} AND status = 'active'
    LIMIT 1
  `);
  const row = rows[0];
  if (!row) return null;

  const [services, bookingPolicy, pricingPolicy, toneProfile] = await Promise.all([
    listActiveFirmServices(firmId),
    getFirmBookingPolicy(firmId),
    getFirmPricingPolicy(firmId),
    getFirmToneProfile(firmId),
  ]);

  return {
    firm: mapFirm(row),
    services,
    bookingPolicy,
    pricingPolicy,
    toneProfile,
  };
}

export async function getFirmProfileBySlug(slug: string): Promise<FirmAgentProfile | FirmNotFound | FirmInactive> {
  const firm = await getFirmBySlug(slug);
  if ("kind" in firm) return firm;
  const profile = await getFirmProfile(firm.id);
  if (!profile) return { kind: "not_found", slug };
  return profile;
}

export async function createFirm(input: {
  name: string;
  industry: Firm["industry"];
  jurisdiction: string;
}): Promise<Firm> {
  const name = normalizeFirmName(input.name);
  if (!name) {
    throw new Error("Firm name is required.");
  }

  const baseSlug = slugifyFirmName(name);
  if (!baseSlug) {
    throw new Error("Firm name must contain at least one letter or number.");
  }

  const existing = await getActiveFirmByIdentity(name, input.industry, input.jurisdiction);
  if (existing) {
    return existing;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const usedSlugs = await getFirmSlugsWithPrefix(baseSlug);
    const slug = pickAvailableSlug(baseSlug, usedSlugs);
    const sql = getSql();
    const rows = toRows<FirmRow>(await sql`
      INSERT INTO firms (name, slug, industry, jurisdiction, status)
      VALUES (${name}, ${slug}, ${input.industry}, ${input.jurisdiction}, 'active')
      ON CONFLICT (slug) DO NOTHING
      RETURNING id, name, slug, industry, jurisdiction, website_url, status
    `);

    const inserted = rows[0];
    if (inserted) {
      return mapFirm(inserted);
    }

    const retry = await getActiveFirmByIdentity(name, input.industry, input.jurisdiction);
    if (retry) {
      return retry;
    }
  }

  throw new Error(`Unable to provision firm "${name}" after repeated slug collisions.`);
}

export async function deleteFirmBySlug(slug: string): Promise<Firm | FirmNotFound> {
  const row = await getFirmRecordBySlug(slug);
  if (!row) return { kind: "not_found", slug };

  const firm = mapFirm(row);
  const sql = getSql();
  await sql.transaction((tx) =>
    buildFirmDeletionStatements({ firmId: firm.id, firmSlug: firm.slug }, tx),
  );

  return firm;
}
