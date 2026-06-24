import { describe, expect, it, vi } from "vitest";
import { isTransientDatabaseError, wrapNeonWithRetry } from "./client.ts";

describe("database client retry", () => {
  it("shouldTreatNeonDnsFailuresAsTransient", () => {
    expect(
      isTransientDatabaseError(
        Object.assign(new Error("Error connecting to database: TypeError: fetch failed"), {
          sourceError: Object.assign(new TypeError("fetch failed"), {
            cause: { code: "ENOTFOUND", hostname: "api.eu-west-2.aws.neon.tech" },
          }),
        }),
      ),
    ).toBe(true);
  });

  it("shouldNotRetryConstraintViolations", () => {
    expect(
      isTransientDatabaseError(
        Object.assign(new Error('duplicate key value violates unique constraint "leads_pkey"'), {
          code: "23505",
        }),
      ),
    ).toBe(false);
  });

  it("shouldRetryTransientErrorsUpToThreeAttempts", async () => {
    const base = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error("Error connecting to database: TypeError: fetch failed"), {
          sourceError: { code: "ENOTFOUND" },
        }),
      )
      .mockResolvedValueOnce([{ ok: 1 }]);

    const sql = wrapNeonWithRetry(base as never);
    await expect(sql`SELECT 1`).resolves.toEqual([{ ok: 1 }]);
    expect(base).toHaveBeenCalledTimes(2);
  });
});
