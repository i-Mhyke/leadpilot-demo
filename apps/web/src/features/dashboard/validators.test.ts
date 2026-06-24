import { describe, expect, it } from "vitest";
import { ContentInsightRequestError, parseContentInsightRequest } from "./validators";

describe("dashboard server validators", () => {
  it("rejects browser firmId at the server boundary", () => {
    expect(() =>
      parseContentInsightRequest({
        firmSlug: "demo-law",
        firmId: "evil-firm",
      }),
    ).toThrowError(ContentInsightRequestError);
  });

  it("rejects unknown fields", () => {
    try {
      parseContentInsightRequest({
        firmSlug: "demo-law",
        status: "completed",
      });
      expect.fail("expected validation error");
    } catch (error) {
      expect(error).toBeInstanceOf(ContentInsightRequestError);
      expect((error as ContentInsightRequestError).code).toBe("unexpected_field");
    }
  });

  it("rejects empty firmSlug", () => {
    try {
      parseContentInsightRequest({ firmSlug: "  " });
      expect.fail("expected validation error");
    } catch (error) {
      expect(error).toBeInstanceOf(ContentInsightRequestError);
      expect((error as ContentInsightRequestError).code).toBe("invalid_firm_slug");
    }
  });

  it("accepts valid firmSlug and optional dates", () => {
    expect(
      parseContentInsightRequest({
        firmSlug: "demo-law",
        from: "2026-01-01T00:00:00.000Z",
      }),
    ).toEqual({
      firmSlug: "demo-law",
      from: "2026-01-01T00:00:00.000Z",
      to: undefined,
    });
  });
});
