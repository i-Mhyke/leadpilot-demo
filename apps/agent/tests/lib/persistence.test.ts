import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSessionBindingsForFirmSlug,
  getSessionBinding,
  resetPersistenceStateForTests,
  resolveBinding,
  setSessionBindingForTests,
} from "../../src/agent/lib/persistence.ts";

const getFirmBySlug = vi.fn();
const resolveConversationContext = vi.fn();

vi.mock("@leadpilot/db", () => ({
  getFirmBySlug: (...args: unknown[]) => getFirmBySlug(...args),
  resolveConversationContext: (...args: unknown[]) => resolveConversationContext(...args),
}));

describe("clearSessionBindingsForFirmSlug", () => {
  beforeEach(() => {
    resetPersistenceStateForTests();
  });

  it("removes only bindings for the deleted firm slug", () => {
    setSessionBindingForTests("avance/browser-1", {
      firmId: "firm-1",
      firmSlug: "avance",
      conversationId: "conv-1",
    });
    setSessionBindingForTests("demo-law/browser-2", {
      firmId: "firm-2",
      firmSlug: "demo-law",
      conversationId: "conv-2",
    });

    clearSessionBindingsForFirmSlug("avance");

    expect(getSessionBinding("avance/browser-1")).toBeUndefined();
    expect(getSessionBinding("demo-law/browser-2")).toMatchObject({
      firmSlug: "demo-law",
    });
  });
});

describe("resolveBinding", () => {
  beforeEach(() => {
    resetPersistenceStateForTests();
    getFirmBySlug.mockReset();
    resolveConversationContext.mockReset();
  });

  it("drops cached bindings when the firm no longer exists", async () => {
    setSessionBindingForTests("avance/browser-1", {
      firmId: "firm-1",
      firmSlug: "avance",
      conversationId: "conv-1",
      brainSnapshot: {
        revision: 1,
        contentHash: "abc123",
        compiledAt: "2026-06-24T00:00:00.000Z",
        compiled: {
          businessSummary: "Avance",
          tone: { notes: [] },
          greeting: "Hello",
          qualificationPosture: [],
          escalationRules: [],
          forbiddenClaims: [],
          serviceEmphasis: [],
        },
      },
    });
    getFirmBySlug.mockResolvedValue({ kind: "not_found", slug: "avance" });

    await expect(resolveBinding("avance", "browser-1", "avance/browser-1")).rejects.toThrow(
      "Unknown firm.",
    );
    expect(getSessionBinding("avance/browser-1")).toBeUndefined();
  });
});
