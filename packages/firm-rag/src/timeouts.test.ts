import { describe, expect, it } from "vitest";
import { readFirmEmbeddingQueryTimeoutMs } from "./timeouts.ts";

describe("firm-rag timeouts", () => {
  it("defaults query timeout to 12 seconds", () => {
    expect(readFirmEmbeddingQueryTimeoutMs({})).toBe(12_000);
  });

  it("rejects invalid query timeout values", () => {
    expect(() => readFirmEmbeddingQueryTimeoutMs({ FIRM_EMBEDDING_QUERY_TIMEOUT_MS: "0" })).toThrow();
  });
});
