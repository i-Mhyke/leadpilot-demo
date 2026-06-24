import { describe, expect, it } from "vitest";
import { readLegalEmbeddingQueryTimeoutMs } from "./timeouts.ts";

describe("legal-rag timeouts", () => {
  it("defaults query timeout to 12 seconds", () => {
    expect(readLegalEmbeddingQueryTimeoutMs({})).toBe(12_000);
  });
});
