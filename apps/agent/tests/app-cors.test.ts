import { afterEach, describe, expect, it } from "vitest";
import app from "../src/app.ts";

describe("agent app CORS", () => {
  const originalAllowedOrigins = process.env.LEADPILOT_ALLOWED_ORIGINS;
  const originalPublicChat = process.env.LEADPILOT_PUBLIC_CHAT;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalAllowedOrigins === undefined) delete process.env.LEADPILOT_ALLOWED_ORIGINS;
    else process.env.LEADPILOT_ALLOWED_ORIGINS = originalAllowedOrigins;

    if (originalPublicChat === undefined) delete process.env.LEADPILOT_PUBLIC_CHAT;
    else process.env.LEADPILOT_PUBLIC_CHAT = originalPublicChat;

    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  it("attaches CORS headers to the stream route when the browser origin is allowed", async () => {
    process.env.NODE_ENV = "production";
    process.env.LEADPILOT_ALLOWED_ORIGINS = "https://leadpilot.kosinu.com";
    process.env.LEADPILOT_PUBLIC_CHAT = "true";

    const response = await app.request(
      "http://localhost/agents/leadpilot/adeola-oyinlade-co%2Fsession-123?wait=result",
      {
        headers: {
          Origin: "https://leadpilot.kosinu.com",
        },
      },
    );

    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://leadpilot.kosinu.com",
    );
  });

  it("rejects disallowed browser origins on the stream route", async () => {
    process.env.NODE_ENV = "production";
    process.env.LEADPILOT_ALLOWED_ORIGINS = "https://leadpilot.kosinu.com";

    const response = await app.request(
      "http://localhost/agents/leadpilot/adeola-oyinlade-co%2Fsession-123?wait=result",
      {
        headers: {
          Origin: "https://evil.example",
        },
      },
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "forbidden_origin",
      message: "This chat origin is not allowed.",
    });
  });
});
