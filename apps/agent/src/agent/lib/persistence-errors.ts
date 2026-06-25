const RECOVERABLE_PERSISTENCE_PATTERNS: Array<{ reason: string; pattern: RegExp }> = [
  { reason: "missing_database_url", pattern: /DATABASE_URL is required/i },
  { reason: "connection_unavailable", pattern: /ECONNREFUSED|ECONNRESET|EAI_AGAIN|ENOTFOUND|ETIMEDOUT/i },
  { reason: "connection_unavailable", pattern: /fetch failed/i },
  { reason: "database_unavailable", pattern: /database.*unavailable/i },
  { reason: "database_unavailable", pattern: /connection.*(failed|refused|reset|terminated|timed out)/i },
];

export function classifyRecoverablePersistenceError(error: unknown): string | null {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  for (const candidate of RECOVERABLE_PERSISTENCE_PATTERNS) {
    if (candidate.pattern.test(message)) return candidate.reason;
  }
  return null;
}

export function persistenceFailureMessage(resourceLabel: string): string {
  return `${resourceLabel} persistence is unavailable right now.`;
}
