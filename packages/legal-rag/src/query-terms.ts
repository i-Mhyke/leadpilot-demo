const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "there",
  "this",
  "to",
  "was",
  "what",
  "when",
  "where",
  "which",
  "who",
  "with",
]);

export function extractSearchTerms(query: string, maxTerms = 8): string[] {
  const raw = query.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const terms: string[] = [];

  for (const term of raw) {
    if (term.length < 3 || STOPWORDS.has(term)) continue;
    if (terms.includes(term)) continue;
    terms.push(term);
    if (terms.length >= maxTerms) break;
  }

  return terms;
}

export function buildRelaxedTsQuery(terms: string[]): string | null {
  if (terms.length === 0) return null;
  if (terms.length === 1) return terms[0]!;

  const anchors = terms.slice(0, 2);
  const optional = terms.slice(2, 6);
  if (optional.length === 0) {
    return anchors.join(" & ");
  }

  return `${anchors.join(" & ")} & (${optional.join(" | ")})`;
}
