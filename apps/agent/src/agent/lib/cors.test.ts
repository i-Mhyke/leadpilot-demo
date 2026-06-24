import { describe, expect, it } from "vitest";
import { corsPreflightResponse, isAllowedChatOrigin, resolveCorsAllowedOrigin } from "./cors.ts";

describe("chat cors guardrails", () => {
  it("rejects production chat origins when no allowlist or public override is set", () => {
    const request = new Request("http://localhost", {
      headers: { Origin: "https://evil.example" },
    });

    expect(
      resolveCorsAllowedOrigin(request, {
        NODE_ENV: "production",
      }),
    ).toBeNull();
    expect(
      isAllowedChatOrigin(request, {
        NODE_ENV: "production",
      }),
    ).toBe(false);
  });

  it("allows configured production origins", () => {
    const request = new Request("http://localhost", {
      headers: { Origin: "https://leadpilot.example" },
    });

    expect(
      resolveCorsAllowedOrigin(request, {
        NODE_ENV: "production",
        LEADPILOT_ALLOWED_ORIGINS: "https://leadpilot.example",
      }),
    ).toBe("https://leadpilot.example");
    expect(
      isAllowedChatOrigin(request, {
        NODE_ENV: "production",
        LEADPILOT_ALLOWED_ORIGINS: "https://leadpilot.example",
      }),
    ).toBe(true);
  });

  it("responds with a forbidden preflight when the origin is not accepted", () => {
    const response = corsPreflightResponse(
      new Request("http://localhost", { headers: { Origin: "https://evil.example" } }),
      { NODE_ENV: "production" },
    );

    expect(response.status).toBe(403);
  });
});
