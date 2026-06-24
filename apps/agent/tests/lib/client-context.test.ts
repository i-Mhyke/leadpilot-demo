import { afterEach, describe, expect, it } from "vitest";
import {
  LEADPILOT_CLIENT_CONTEXT_HEADER,
  resolveClientContextForRequest,
} from "../../src/agent/lib/client-context.ts";

describe("resolveClientContextForRequest", () => {
  const originalDevFirm = process.env.LEADPILOT_DEV_FIRM_SLUG;
  const originalStrict = process.env.LEADPILOT_STRICT_INTAKE;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalDevFirm === undefined) delete process.env.LEADPILOT_DEV_FIRM_SLUG;
    else process.env.LEADPILOT_DEV_FIRM_SLUG = originalDevFirm;
    if (originalStrict === undefined) delete process.env.LEADPILOT_STRICT_INTAKE;
    else process.env.LEADPILOT_STRICT_INTAKE = originalStrict;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  it("uses the intake header when firm slug and browser session are present", () => {
    const request = new Request("http://localhost/eve/v1/session", {
      headers: {
        [LEADPILOT_CLIENT_CONTEXT_HEADER]: JSON.stringify({
          firmSlug: "demo-law",
          browserSessionId: "browser-1",
        }),
      },
    });

    expect(resolveClientContextForRequest(request)).toEqual({
      firmSlug: "demo-law",
      browserSessionId: "browser-1",
      localConversationId: undefined,
      sourceUrl: undefined,
    });
  });

  it("falls back to dev terminal context when configured", () => {
    process.env.NODE_ENV = "development";
    process.env.LEADPILOT_DEV_FIRM_SLUG = "demo-law";
    delete process.env.LEADPILOT_STRICT_INTAKE;

    const request = new Request("http://localhost/eve/v1/session");
    expect(resolveClientContextForRequest(request)).toEqual({
      firmSlug: "demo-law",
      browserSessionId: "dev-terminal",
      localConversationId: undefined,
      sourceUrl: "eve://dev-terminal",
    });
  });

  it("stays fail-closed when strict intake is enabled", () => {
    process.env.NODE_ENV = "development";
    process.env.LEADPILOT_DEV_FIRM_SLUG = "demo-law";
    process.env.LEADPILOT_STRICT_INTAKE = "true";

    const request = new Request("http://localhost/eve/v1/session");
    expect(resolveClientContextForRequest(request)).toBeNull();
  });
});
