import { describe, expect, it } from "vitest";
import { eveAgentProxyTarget, resolveAgentBaseUrl } from "./agent-base-url";

describe("resolveAgentBaseUrl", () => {
  it("trims trailing slashes", () => {
    expect(resolveAgentBaseUrl({ AGENT_BASE_URL: "https://agent.example.com/" })).toBe(
      "https://agent.example.com",
    );
  });

  it("falls back for local dev", () => {
    expect(resolveAgentBaseUrl({})).toBe("http://127.0.0.1:3001");
  });
});

describe("eveAgentProxyTarget", () => {
  it("builds the nitro proxy target", () => {
    expect(eveAgentProxyTarget("https://agent.example.com")).toBe(
      "https://agent.example.com/eve/**",
    );
  });
});
