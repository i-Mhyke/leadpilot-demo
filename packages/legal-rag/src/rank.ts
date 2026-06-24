import type { LegalSearchResult } from "./types.ts";

const MAX_SNIPPET_CHARS = 900;

export function rankLegalResults(input: {
  semanticResults: LegalSearchResult[];
  exactResults: LegalSearchResult[];
  graphResults: LegalSearchResult[];
  limit: number;
}): LegalSearchResult[] {
  const merged = new Map<string, LegalSearchResult>();

  for (const result of [...input.exactResults, ...input.semanticResults, ...input.graphResults]) {
    const existing = merged.get(result.chunkId);
    if (!existing) {
      merged.set(result.chunkId, result);
      continue;
    }

    merged.set(result.chunkId, {
      ...existing,
      similarity: Math.max(existing.similarity ?? 0, result.similarity ?? 0),
      exactMatchScore: Math.max(existing.exactMatchScore ?? 0, result.exactMatchScore ?? 0),
      relationshipType: existing.relationshipType ?? result.relationshipType,
      relationshipReason: existing.relationshipReason ?? result.relationshipReason,
    });
  }

  return [...merged.values()]
    .map((result, index) => ({
      ...result,
      freshnessRank: index,
      text: compressSnippet(result.text),
    }))
    .sort((a, b) => scoreResult(b) - scoreResult(a))
    .slice(0, input.limit);
}

function scoreResult(result: LegalSearchResult): number {
  return (result.exactMatchScore ?? 0) * 0.45 + (result.similarity ?? 0) * 0.45 + (result.relationshipType ? 0.1 : 0);
}

export function compressSnippet(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_SNIPPET_CHARS) return trimmed;
  return `${trimmed.slice(0, MAX_SNIPPET_CHARS).trimEnd()}…`;
}
