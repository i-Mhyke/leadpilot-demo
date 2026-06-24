import { describe, expect, it } from "vitest";
import { LEADPILOT_CLIENT_CONTEXT_HEADER, parseClientContextHeader, resolveClientContextForRequest } from "./client-context.ts";

describe("client context parsing", () => {
  it("rejects malformed client contexts without a browser session id", () => {
    const request = new Request("http://localhost", {
      headers: {
        [LEADPILOT_CLIENT_CONTEXT_HEADER]: JSON.stringify({ firmSlug: "avance" }),
      },
    });

    expect(parseClientContextHeader(request)).toBeNull();
  });

  it("returns the trimmed browser session and firm slug", () => {
    const request = new Request("http://localhost", {
      headers: {
        [LEADPILOT_CLIENT_CONTEXT_HEADER]: JSON.stringify({
          firmSlug: " avance ",
          browserSessionId: " browser-1 ",
          localConversationId: " conv-1 ",
          sourceUrl: " https://example.com ",
        }),
      },
    });

    expect(parseClientContextHeader(request)).toEqual({
      firmSlug: "avance",
      browserSessionId: "browser-1",
      localConversationId: "conv-1",
      sourceUrl: "https://example.com",
    });
  });

  it("falls back to a dev browser session when strict intake is off", () => {
    const request = new Request("http://localhost");

    expect(
      resolveClientContextForRequest(request, {
        LEADPILOT_DEV_FIRM_SLUG: "demo-law",
        LEADPILOT_DEV_BROWSER_SESSION_ID: "dev-browser",
        NODE_ENV: "development",
      }),
    ).toEqual({
      firmSlug: "demo-law",
      browserSessionId: "dev-browser",
      sourceUrl: "eve://dev-terminal",
    });
  });
});
