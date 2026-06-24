import { describe, expect, it } from "vitest";
import { buildRelaxedTsQuery, extractSearchTerms } from "./query-terms.ts";

describe("query-terms", () => {
  it("extracts meaningful terms and drops stop words", () => {
    expect(
      extractSearchTerms(
        "Nigerian fintech startup regulatory compliance requirements founder agreements",
      ),
    ).toEqual([
      "nigerian",
      "fintech",
      "startup",
      "regulatory",
      "compliance",
      "requirements",
      "founder",
      "agreements",
    ]);
  });

  it("builds a relaxed tsquery with anchor and optional terms", () => {
    expect(buildRelaxedTsQuery(["nigerian", "fintech", "startup", "regulatory"])).toBe(
      "nigerian & fintech & (startup | regulatory)",
    );
  });
});
