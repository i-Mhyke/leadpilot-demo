import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { getDatabaseConfig } from "./index.ts";

const TRANSIENT_DB_ERROR_CODES = new Set(["ENOTFOUND", "EAI_AGAIN", "ECONNRESET", "ETIMEDOUT"]);

let sql: NeonQueryFunction<false, false> | null = null;

function getSourceError(error: unknown): unknown {
  if (!error || typeof error !== "object") return error;
  if ("sourceError" in error) {
    return (error as { sourceError?: unknown }).sourceError;
  }
  if ("cause" in error) {
    return (error as { cause?: unknown }).cause;
  }
  return error;
}

export function isTransientDatabaseError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  if (/Error connecting to database: TypeError: fetch failed/i.test(message)) {
    return true;
  }

  const source = getSourceError(error);
  if (source && typeof source === "object" && "code" in source) {
    return TRANSIENT_DB_ERROR_CODES.has(String(source.code));
  }

  return false;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function wrapNeonWithRetry(
  base: NeonQueryFunction<false, false>,
): NeonQueryFunction<false, false> {
  const execute = (async (...args: Parameters<NeonQueryFunction<false, false>>) => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await (base as (...queryArgs: typeof args) => ReturnType<NeonQueryFunction<false, false>>)(
          ...args,
        );
      } catch (error) {
        lastError = error;
        if (!isTransientDatabaseError(error) || attempt === 2) {
          throw error;
        }
        await delay(100 * 2 ** attempt);
      }
    }
    throw lastError;
  }) as NeonQueryFunction<false, false>;

  if (base.transaction) {
    execute.transaction = base.transaction.bind(base);
  }

  return execute;
}

export function getSql(): NeonQueryFunction<false, false> {
  if (!sql) {
    const { databaseUrl } = getDatabaseConfig();
    sql = wrapNeonWithRetry(neon(databaseUrl));
  }
  return sql;
}

/** @internal Test-only override for mocked SQL. */
export function setSqlForTests(mock: NeonQueryFunction<false, false> | null) {
  if (!mock) {
    sql = null;
    return;
  }

  const withTransaction = mock as NeonQueryFunction<false, false> & {
    transaction?: NeonQueryFunction<false, false>["transaction"];
  };

  if (!withTransaction.transaction) {
    withTransaction.transaction = (async (queriesOrFn) => {
      if (typeof queriesOrFn === "function") {
        return queriesOrFn(withTransaction as never);
      }

      const results: unknown[] = [];
      try {
        for (const query of queriesOrFn) {
          results.push(await query);
        }
        return results;
      } catch (error) {
        // Simulate Postgres rollback: discard partial transaction results.
        results.length = 0;
        throw error;
      }
    }) as NeonQueryFunction<false, false>["transaction"];
  }

  sql = withTransaction;
}
