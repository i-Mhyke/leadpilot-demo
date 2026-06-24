import { describe, expect, it, vi } from "vitest";
import { setSqlForTests } from "./client.ts";
import { consumeRequestRateLimit, RateLimitExceededError } from "./request-rate-limits.ts";

describe("request rate limits", () => {
  it("increments within the active window", async () => {
    const sql = vi.fn().mockResolvedValueOnce([
      {
        count: 2,
        window_start: "2026-06-25T10:00:00.000Z",
      },
    ]);
    setSqlForTests(sql as never);

    const state = await consumeRequestRateLimit({
      scope: "chat.turn.burst",
      rateKey: "firm-a:browser-1:127.0.0.1",
      limit: 8,
      windowMs: 60_000,
      now: new Date("2026-06-25T10:00:30.000Z"),
    });

    expect(state).toMatchObject({
      scope: "chat.turn.burst",
      rateKey: "firm-a:browser-1:127.0.0.1",
      count: 2,
      remaining: 6,
      windowStart: "2026-06-25T10:00:00.000Z",
    });
    expect(String(sql.mock.calls[0]?.[0])).toContain("request_rate_limits");
  });

  it("throws once the bucket has been exhausted", async () => {
    const sql = vi.fn().mockResolvedValueOnce([
      {
        count: 9,
        window_start: "2026-06-25T10:00:00.000Z",
      },
    ]);
    setSqlForTests(sql as never);

    await expect(
      consumeRequestRateLimit({
        scope: "chat.turn.burst",
        rateKey: "firm-a:browser-1:127.0.0.1",
        limit: 8,
        windowMs: 60_000,
        now: new Date("2026-06-25T10:00:30.000Z"),
      }),
    ).rejects.toBeInstanceOf(RateLimitExceededError);
  });
});
