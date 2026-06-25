import { getSql } from "./client.ts";
import { rows as toRows } from "./sql.ts";

export class RateLimitExceededError extends Error {
  public readonly scope: string;
  public readonly rateKey: string;
  public readonly limit: number;
  public readonly windowMs: number;
  public readonly retryAfterSeconds: number;

  constructor(
    message: string,
    scope: string,
    rateKey: string,
    limit: number,
    windowMs: number,
    retryAfterSeconds: number,
  ) {
    super(message);
    this.name = "RateLimitExceededError";
    this.scope = scope;
    this.rateKey = rateKey;
    this.limit = limit;
    this.windowMs = windowMs;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export type RequestRateLimitPolicy = {
  scope: string;
  limit: number;
  windowMs: number;
};

export type RequestRateLimitState = RequestRateLimitPolicy & {
  rateKey: string;
  count: number;
  remaining: number;
  windowStart: string;
  windowResetAt: string;
  retryAfterSeconds: number;
};

function normalizeWindowStart(now: Date, windowMs: number) {
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

export async function consumeRequestRateLimit(input: RequestRateLimitPolicy & { rateKey: string; now?: Date }): Promise<RequestRateLimitState> {
  const sql = getSql();
  const now = input.now ?? new Date();
  const windowStart = normalizeWindowStart(now, input.windowMs).toISOString();
  const rows = toRows<{ count: number; window_start: string }>(await sql`
    INSERT INTO request_rate_limits (scope, rate_key, window_start, count, last_seen_at)
    VALUES (${input.scope}, ${input.rateKey}, ${windowStart}::timestamptz, 1, ${now.toISOString()}::timestamptz)
    ON CONFLICT (scope, rate_key) DO UPDATE
    SET count = CASE
          WHEN request_rate_limits.window_start = EXCLUDED.window_start THEN request_rate_limits.count + 1
          ELSE 1
        END,
        window_start = CASE
          WHEN request_rate_limits.window_start = EXCLUDED.window_start THEN request_rate_limits.window_start
          ELSE EXCLUDED.window_start
        END,
        last_seen_at = EXCLUDED.last_seen_at,
        updated_at = now()
    RETURNING count, window_start
  `);

  const row = rows[0];
  if (!row) {
    throw new Error(`Rate limit write returned no rows for scope "${input.scope}".`);
  }

  const windowStartAt = new Date(row.window_start);
  const windowResetAt = new Date(windowStartAt.getTime() + input.windowMs);
  const retryAfterSeconds = Math.max(1, Math.ceil((windowResetAt.getTime() - now.getTime()) / 1000));
  const remaining = Math.max(0, input.limit - row.count);

  if (row.count > input.limit) {
    throw new RateLimitExceededError(
      `Rate limit exceeded for "${input.scope}".`,
      input.scope,
      input.rateKey,
      input.limit,
      input.windowMs,
      retryAfterSeconds,
    );
  }

  return {
    scope: input.scope,
    limit: input.limit,
    windowMs: input.windowMs,
    rateKey: input.rateKey,
    count: row.count,
    remaining,
    windowStart: row.window_start,
    windowResetAt: windowResetAt.toISOString(),
    retryAfterSeconds,
  };
}
