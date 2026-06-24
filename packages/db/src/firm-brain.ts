import { createHash } from "node:crypto";
import type {
  FirmBrainConfig,
  FirmBrainSnapshot,
  FirmBrainSlots,
  FirmBrainTone,
} from "@leadpilot/shared";
import { getSql } from "./client.ts";
import { rows as toRows } from "./sql.ts";

export class FirmBrainCompilationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FirmBrainCompilationError";
  }
}

type FirmBrainRow = {
  id: string;
  firm_id: string;
  source_filename: string;
  raw_markdown: string;
  content_hash: string;
  revision: number;
  compiled_json: Record<string, unknown>;
  compiled_at: string;
  created_at: string;
  updated_at: string;
};

type FirmBrainSnapshotRow = {
  revision: number;
  content_hash: string;
  compiled_at: string;
  compiled_json: Record<string, unknown>;
};

const BRAIN_SECTION_ALIASES = new Map<string, keyof FirmBrainSlots | "tone">([
  ["business summary", "businessSummary"],
  ["summary", "businessSummary"],
  ["business overview", "businessSummary"],
  ["about the business", "businessSummary"],
  ["tone", "tone"],
  ["voice", "tone"],
  ["greeting", "greeting"],
  ["opening greeting", "greeting"],
  ["qualification posture", "qualificationPosture"],
  ["qualification", "qualificationPosture"],
  ["qualification guidance", "qualificationPosture"],
  ["escalation rules", "escalationRules"],
  ["escalation", "escalationRules"],
  ["forbidden claims", "forbiddenClaims"],
  ["forbidden", "forbiddenClaims"],
  ["do not say", "forbiddenClaims"],
  ["service emphasis", "serviceEmphasis"],
  ["service focus", "serviceEmphasis"],
  ["services", "serviceEmphasis"],
  ["qualification hints", "qualificationHints"],
  ["starter questions", "suggestedQuestions"],
  ["initial suggested questions", "suggestedQuestions"],
  ["suggested initial questions", "suggestedQuestions"],
  ["suggested questions", "suggestedQuestions"],
]);

function normalizeMarkdown(content: string): string {
  const withoutBom = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
  return withoutBom.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function normalizeHeading(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[`*_~]+/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMarkdownSections(markdown: string): Array<{ heading: string; body: string }> {
  const sections: Array<{ heading: string; body: string }> = [];
  let currentHeading = "";
  let currentBody: string[] = [];

  const flush = () => {
    const body = currentBody.join("\n").trim();
    if (currentHeading || body) {
      sections.push({ heading: currentHeading, body });
    }
    currentHeading = "";
    currentBody = [];
  };

  for (const line of markdown.split("\n")) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flush();
      currentHeading = headingMatch[2]!.trim();
      continue;
    }
    currentBody.push(line);
  }

  flush();
  return sections;
}

function stripListMarker(line: string): string {
  return line.replace(/^(?:[-*+]|[0-9]+[.)])\s+/, "").trim();
}

function parseListItems(block: string): string[] {
  return block
    .split("\n")
    .map((line) => stripListMarker(line))
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeBlock(block: string): string {
  return block
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

function cleanLabel(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

type BrainQuestionSource = {
  firm: {
    name: string;
    industry: string;
  };
  services: Array<{
    name: string;
    qualificationQuestions: string[];
    visitorExamples: string[];
    isActive: boolean;
  }>;
};

function servicePrompt(service: BrainQuestionSource["services"][number]) {
  const qualificationQuestion = service.qualificationQuestions[0]?.trim();
  if (qualificationQuestion) {
    return qualificationQuestion;
  }

  const visitorExample = service.visitorExamples[0]?.trim();
  if (visitorExample) {
    return visitorExample.endsWith("?") ? visitorExample : `${visitorExample}?`;
  }

  return `We need help with ${cleanLabel(service.name)}. What should we prepare before the first call?`;
}

export function deriveSuggestedQuestions(profile: BrainQuestionSource | null): string[] {
  if (!profile) {
    return [
      "What should we prepare before the first call?",
      "Which details decide whether this is a fit?",
      "What would make this request urgent enough to escalate?",
    ];
  }

  const activeServices = profile.services.filter((service) => service.isActive);
  const prompts = activeServices.slice(0, 3).map(servicePrompt);
  const industry = cleanLabel(profile.firm.industry.replace(/_/g, " "));

  for (const prompt of [
    `What should a ${industry} business prepare before the first call?`,
    "Which facts decide whether this is a fit?",
    "What would make this request urgent enough to escalate?",
  ]) {
    if (prompts.length >= 3) break;
    if (!prompts.includes(prompt)) {
      prompts.push(prompt);
    }
  }

  while (prompts.length < 3) {
    prompts.push("What should we prepare before the first call?");
  }

  return prompts.slice(0, 3);
}

async function loadBrainQuestionSource(firmId: string): Promise<BrainQuestionSource | null> {
  const sql = getSql();
  const firmRows = toRows<{ name: string; industry: string }>(await sql`
    SELECT name, industry
    FROM firms
    WHERE id = ${firmId}
      AND status = 'active'
    LIMIT 1
  `);
  const firm = firmRows[0];
  if (!firm) {
    return null;
  }

  const serviceRows = toRows<{
    name: string;
    qualification_questions: string[];
    visitor_examples: string[];
    is_active: boolean;
  }>(await sql`
    SELECT name, qualification_questions, visitor_examples, is_active
    FROM firm_services
    WHERE firm_id = ${firmId}
      AND is_active = true
    ORDER BY name ASC
  `);

  return {
    firm: {
      name: firm.name,
      industry: firm.industry,
    },
    services: serviceRows.map((service) => ({
      name: service.name,
      qualificationQuestions: service.qualification_questions ?? [],
      visitorExamples: service.visitor_examples ?? [],
      isActive: service.is_active,
    })),
  };
}

function parseToneBlock(block: string): FirmBrainTone {
  const tone: FirmBrainTone = { notes: [] };

  for (const rawLine of block.split("\n")) {
    const line = stripListMarker(rawLine);
    if (!line) continue;

    const match = line.match(
      /^(voice|formality(?: level)?|preferred greeting|greeting|avoid(?: phrases)?|notes?)\s*[:\-]\s*(.+)$/i,
    );
    if (!match) {
      tone.notes.push(line);
      continue;
    }

    const key = normalizeHeading(match[1]!);
    const value = match[2]!.trim();

    if (key === "voice") {
      tone.voice = value;
    } else if (key.startsWith("formality")) {
      tone.formalityLevel = value;
    } else if (key === "preferred greeting" || key === "greeting") {
      tone.preferredGreeting = value;
    } else if (key.startsWith("avoid")) {
      tone.notes.push(`Avoid: ${value}`);
    } else {
      tone.notes.push(value);
    }
  }

  return tone;
}

function mapSectionsToSlots(markdown: string): FirmBrainSlots {
  const sections = parseMarkdownSections(markdown);
  const slots: FirmBrainSlots = {
    tone: { notes: [] },
    qualificationPosture: [],
    qualificationHints: [],
    escalationRules: [],
    forbiddenClaims: [],
    serviceEmphasis: [],
  };

  const collected = new Map<keyof FirmBrainSlots | "tone", string[]>();

  for (const section of sections) {
    const normalizedHeading = normalizeHeading(section.heading);
    const slot = BRAIN_SECTION_ALIASES.get(normalizedHeading);
    if (!slot || !section.body) continue;
    const bucket = collected.get(slot) ?? [];
    bucket.push(section.body);
    collected.set(slot, bucket);
  }

  const businessSummary = collected.get("businessSummary");
  if (businessSummary?.length) {
    slots.businessSummary = normalizeBlock(businessSummary.join("\n\n"));
  }

  const greeting = collected.get("greeting");
  if (greeting?.length) {
    slots.greeting = normalizeBlock(greeting.join("\n\n"));
  }

  const qualificationPosture = collected.get("qualificationPosture");
  if (qualificationPosture?.length) {
    slots.qualificationPosture = qualificationPosture.flatMap((block) => parseListItems(block));
  }

  const qualificationHints = collected.get("qualificationHints");
  if (qualificationHints?.length) {
    slots.qualificationHints = qualificationHints.flatMap((block) => parseListItems(block));
  }

  const escalationRules = collected.get("escalationRules");
  if (escalationRules?.length) {
    slots.escalationRules = escalationRules.flatMap((block) => parseListItems(block));
  }

  const forbiddenClaims = collected.get("forbiddenClaims");
  if (forbiddenClaims?.length) {
    slots.forbiddenClaims = forbiddenClaims.flatMap((block) => parseListItems(block));
  }

  const serviceEmphasis = collected.get("serviceEmphasis");
  if (serviceEmphasis?.length) {
    slots.serviceEmphasis = serviceEmphasis.flatMap((block) => parseListItems(block));
  }

  const suggestedQuestions = collected.get("suggestedQuestions");
  if (suggestedQuestions?.length) {
    slots.suggestedQuestions = suggestedQuestions.flatMap((block) => parseListItems(block));
  }

  const toneBlocks = collected.get("tone");
  if (toneBlocks?.length) {
    slots.tone = toneBlocks.reduce<FirmBrainTone>(
      (acc, block) => {
        const parsed = parseToneBlock(block);
        if (parsed.voice) acc.voice = parsed.voice;
        if (parsed.formalityLevel) acc.formalityLevel = parsed.formalityLevel;
        if (parsed.preferredGreeting) acc.preferredGreeting = parsed.preferredGreeting;
        acc.notes.push(...parsed.notes);
        return acc;
      },
      { notes: [] },
    );
  }

  return slots;
}

export function compileFirmBrainMarkdown(contentMarkdown: string): {
  normalizedMarkdown: string;
  contentHash: string;
  compiled: FirmBrainSlots;
} {
  const normalizedMarkdown = normalizeMarkdown(contentMarkdown);
  if (!normalizedMarkdown) {
    throw new FirmBrainCompilationError("Brain markdown cannot be empty.");
  }

  const compiled = mapSectionsToSlots(normalizedMarkdown);
  const hasRecognizedContent =
    Boolean(compiled.businessSummary) ||
    Boolean(compiled.greeting) ||
    Boolean(compiled.tone.voice) ||
    Boolean(compiled.tone.formalityLevel) ||
    Boolean(compiled.tone.preferredGreeting) ||
    compiled.tone.notes.length > 0 ||
    compiled.qualificationPosture.length > 0 ||
    (compiled.qualificationHints?.length ?? 0) > 0 ||
    compiled.escalationRules.length > 0 ||
    compiled.forbiddenClaims.length > 0 ||
    compiled.serviceEmphasis.length > 0 ||
    (compiled.suggestedQuestions?.length ?? 0) > 0;

  if (!hasRecognizedContent) {
    throw new FirmBrainCompilationError(
      "Brain markdown must include at least one recognized section heading.",
    );
  }

  const contentHash = createHash("sha256").update(normalizedMarkdown).digest("hex");
  return { normalizedMarkdown, contentHash, compiled };
}

function mapBrainRow(row: FirmBrainRow): FirmBrainConfig {
  return {
    firmId: row.firm_id,
    sourceFilename: row.source_filename,
    rawMarkdown: row.raw_markdown,
    contentHash: row.content_hash,
    revision: row.revision,
    compiled: row.compiled_json as unknown as FirmBrainSlots,
    compiledAt: row.compiled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSnapshotRow(row: FirmBrainSnapshotRow): FirmBrainSnapshot {
  return {
    revision: row.revision,
    contentHash: row.content_hash,
    compiledAt: row.compiled_at,
    compiled: row.compiled_json as unknown as FirmBrainSlots,
  };
}

export async function saveFirmBrainConfig(input: {
  firmId: string;
  sourceFilename: string;
  contentMarkdown: string;
}): Promise<FirmBrainConfig> {
  const { normalizedMarkdown, contentHash, compiled } = compileFirmBrainMarkdown(input.contentMarkdown);
  const profile = await loadBrainQuestionSource(input.firmId);
  const persistedCompiled: FirmBrainSlots = {
    ...compiled,
    suggestedQuestions:
      compiled.suggestedQuestions?.length && compiled.suggestedQuestions.length > 0
        ? compiled.suggestedQuestions.slice(0, 3)
        : deriveSuggestedQuestions(profile),
  };
  const sql = getSql();
  const rows = toRows<FirmBrainRow>(await sql`
    WITH upsert AS (
      INSERT INTO firm_brains (
        firm_id, source_filename, raw_markdown, content_hash, revision, compiled_json, compiled_at
      )
      VALUES (
        ${input.firmId},
        ${input.sourceFilename},
        ${normalizedMarkdown},
        ${contentHash},
        1,
        ${JSON.stringify(persistedCompiled)}::jsonb,
        now()
      )
      ON CONFLICT (firm_id) DO UPDATE
      SET source_filename = EXCLUDED.source_filename,
          raw_markdown = EXCLUDED.raw_markdown,
          content_hash = EXCLUDED.content_hash,
          compiled_json = EXCLUDED.compiled_json,
          compiled_at = now(),
          revision = firm_brains.revision + 1,
          updated_at = now()
      WHERE firm_brains.content_hash IS DISTINCT FROM EXCLUDED.content_hash
      RETURNING id, firm_id, source_filename, raw_markdown, content_hash, revision,
                compiled_json, compiled_at, created_at, updated_at
    )
    SELECT id, firm_id, source_filename, raw_markdown, content_hash, revision,
           compiled_json, compiled_at, created_at, updated_at
    FROM upsert
    UNION ALL
    SELECT id, firm_id, source_filename, raw_markdown, content_hash, revision,
           compiled_json, compiled_at, created_at, updated_at
    FROM firm_brains
    WHERE firm_id = ${input.firmId}
      AND NOT EXISTS (SELECT 1 FROM upsert)
    LIMIT 1
  `);

  const row = rows[0];
  if (!row) {
    throw new Error("firm_brains returned no rows");
  }

  return mapBrainRow(row);
}

export async function getFirmBrainConfigByFirmId(firmId: string): Promise<FirmBrainConfig | null> {
  const sql = getSql();
  const rows = toRows<FirmBrainRow>(await sql`
    SELECT id, firm_id, source_filename, raw_markdown, content_hash, revision,
           compiled_json, compiled_at, created_at, updated_at
    FROM firm_brains
    WHERE firm_id = ${firmId}
    LIMIT 1
  `);
  const row = rows[0];
  return row ? mapBrainRow(row) : null;
}

export async function getFirmBrainSnapshotByFirmId(
  firmId: string,
): Promise<FirmBrainSnapshot | null> {
  const sql = getSql();
  const rows = toRows<FirmBrainSnapshotRow>(await sql`
    SELECT revision, content_hash, compiled_at, compiled_json
    FROM firm_brains
    WHERE firm_id = ${firmId}
    LIMIT 1
  `);
  const row = rows[0];
  return row ? mapSnapshotRow(row) : null;
}
