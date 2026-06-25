import { describe, expect, it } from "vitest";
import { buildFirmDeletionStatements } from "./firm-deletion.ts";

describe("buildFirmDeletionStatements", () => {
  it("deletes non-cascade firm-owned tables before the firm row", () => {
    const calls: Array<{ sql: string; values: unknown[] }> = [];
    const tx = ((strings: TemplateStringsArray, ...values: unknown[]) => {
      calls.push({ sql: strings.join(" "), values });
      return Promise.resolve([]);
    }) as never;

    const statements = buildFirmDeletionStatements(
      { firmId: "firm-1", firmSlug: "acme-law" },
      tx,
    );

    expect(statements).toHaveLength(4);
    expect(calls[0]?.sql).toContain("DELETE FROM retrieval_logs");
    expect(calls[1]?.sql).toContain("DELETE FROM legal_unit_chunks");
    expect(calls[2]?.sql).toContain("DELETE FROM request_rate_limits");
    expect(calls[2]?.values).toContain("acme-law:%");
    expect(calls[3]?.sql).toContain("DELETE FROM firms");
  });
});
