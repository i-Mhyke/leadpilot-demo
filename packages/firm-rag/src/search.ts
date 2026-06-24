import type { FirmKnowledgeChunkRow } from "@leadpilot/db";
import type { FirmContentType, FirmSearchResult } from "./types.ts";

const RRF_K = 60;
const MAX_SNIPPET_CHARS = 900;
const DEFAULT_RESULT_LIMIT = 6;

export function parseMinSimilarity(): number {
  const raw = process.env.FIRM_KB_MIN_SIMILARITY ?? "0.45";
  const value = Number(raw);
  if (Number.isNaN(value) || value < 0 || value > 1) {
    throw new Error("FIRM_KB_MIN_SIMILARITY must be between 0 and 1");
  }
  return value;
}

function exactNameBoost(query: string, row: FirmKnowledgeChunkRow): number {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return 0;
  const haystack = [row.text, ...row.heading_path].join(" ").toLowerCase();
  return haystack.includes(normalizedQuery) ? 0.05 : 0;
}

const TEAM_PEOPLE_QUERY =
  /\b(who\b|which lawyer|talk to|team member|speak with|point me|people at|lawyer.{0,30}firm)\b/i;

const TEAM_QUERY_STOP = new Set([
  "who",
  "can",
  "talk",
  "about",
  "this",
  "that",
  "firm",
  "legal",
  "lawyer",
  "team",
  "member",
  "person",
  "speak",
  "with",
  "point",
  "the",
  "and",
  "for",
  "eandc",
]);

export function teamPeopleLexicalQuery(query: string): string {
  const tokens = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !TEAM_QUERY_STOP.has(token));
  const terms = tokens.slice(0, 2).join(" ").trim();
  return terms.length > 0 ? terms : "regulatory compliance";
}

export function isTeamPeopleQuery(query: string): boolean {
  return (
    TEAM_PEOPLE_QUERY.test(query) ||
    /\bteam\b[\s\S]{0,40}\b(regulatory|compliance|lawyer|partner|associate)\b/i.test(query)
  );
}

export function isNamedPersonChunk(row: FirmKnowledgeChunkRow): boolean {
  if (row.content_type !== "person") return false;
  const last = row.heading_path.at(-1) ?? "";
  if (!last || /^\d+\./.test(last)) return false;
  if (/^(team|partners|lawyers|co-founders)/i.test(last)) return false;
  return last.length > 3;
}

function teamPeopleQueryBoost(query: string, row: FirmKnowledgeChunkRow): number {
  if (!isTeamPeopleQuery(query)) return 0;
  if (isNamedPersonChunk(row)) return 0.25;
  return 0;
}

export function fuseFirmSearchResults(input: {
  query: string;
  semanticRows: FirmKnowledgeChunkRow[];
  lexicalRows: FirmKnowledgeChunkRow[];
  limit?: number;
}): FirmSearchResult[] {
  const limit = input.limit ?? DEFAULT_RESULT_LIMIT;
  const scores = new Map<
    string,
    {
      row: FirmKnowledgeChunkRow;
      score: number;
      similarity?: number;
      lexicalRank?: number;
    }
  >();

  input.semanticRows.forEach((row, index) => {
    const rank = index + 1;
    const existing = scores.get(row.chunk_id);
    const rrf = 1 / (RRF_K + rank);
    scores.set(row.chunk_id, {
      row,
      score: (existing?.score ?? 0) + rrf,
      similarity: row.similarity,
      lexicalRank: existing?.lexicalRank,
    });
  });

  input.lexicalRows.forEach((row, index) => {
    const rank = index + 1;
    const existing = scores.get(row.chunk_id);
    const rrf = 1 / (RRF_K + rank);
    scores.set(row.chunk_id, {
      row,
      score: (existing?.score ?? 0) + rrf + exactNameBoost(input.query, row),
      similarity: existing?.similarity ?? row.similarity,
      lexicalRank: row.lexical_rank,
    });
  });

  return [...scores.values()]
    .map((entry) => ({
      ...entry,
      score: entry.score + teamPeopleQueryBoost(input.query, entry.row),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ row, similarity, lexicalRank }) => ({
      source: "firm" as const,
      title: row.title,
      contentType: row.content_type as FirmContentType,
      headingPath: row.heading_path,
      text: row.text.slice(0, MAX_SNIPPET_CHARS),
      informationalOnly: row.content_type === "person",
      chunkId: row.chunk_id,
      documentId: row.document_id,
      similarity,
      lexicalRank,
    }));
}

export function filterSemanticRowsByFloor(
  rows: FirmKnowledgeChunkRow[],
  minSimilarity: number,
  lexicalRows: FirmKnowledgeChunkRow[],
): FirmKnowledgeChunkRow[] {
  const lexicalIds = new Set(lexicalRows.map((row) => row.chunk_id));
  return rows.filter(
    (row) =>
      lexicalIds.has(row.chunk_id) ||
      (row.similarity !== undefined && row.similarity >= minSimilarity),
  );
}
