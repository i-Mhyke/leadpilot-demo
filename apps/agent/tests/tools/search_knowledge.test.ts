import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSearchKnowledgeTool } from "../../src/tools/search_knowledge.ts";

vi.mock("@leadpilot/firm-rag", () => ({
  searchFirmKnowledge: vi.fn(),
}));

vi.mock("@leadpilot/legal-rag", () => ({
  searchLegalKnowledge: vi.fn(),
}));

vi.mock("../../src/agent/lib/session-scope.ts", () => ({
  requireSessionBinding: vi.fn(),
}));

import { searchFirmKnowledge } from "@leadpilot/firm-rag";
import { searchLegalKnowledge } from "@leadpilot/legal-rag";
import { requireSessionBinding } from "../../src/agent/lib/session-scope.ts";

const binding = {
  firmId: "firm-1",
  firmSlug: "demo-law",
  conversationId: "conv-1",
  agentInstanceId: "demo-law/browser-1",
};

describe("search_knowledge tool", () => {
  beforeEach(() => {
    vi.mocked(requireSessionBinding).mockResolvedValue(binding);
    vi.mocked(searchFirmKnowledge).mockReset();
    vi.mocked(searchLegalKnowledge).mockReset();
  });

  it("uses the Nigerian legal KB only when the firm is Nigerian", async () => {
    vi.mocked(searchFirmKnowledge).mockResolvedValue({
      status: "ok",
      results: [{ title: "Company overview", text: "Firm evidence." }],
    });
    vi.mocked(searchLegalKnowledge).mockResolvedValue({
      status: "ok",
      results: [{ citation: "Nigerian law", text: "Legal evidence." }],
    });

    const tool = createSearchKnowledgeTool("demo-law", "browser-1", true);
    await tool.run({
      input: {
        query: "startup compliance",
        scope: "both",
        limit: 4,
      },
    });

    expect(searchFirmKnowledge).toHaveBeenCalledTimes(1);
    expect(searchLegalKnowledge).toHaveBeenCalledTimes(1);
  });

  it("rejects legal scopes for non-Nigerian firms", async () => {
    const tool = createSearchKnowledgeTool("demo-law", "browser-1", false);

    await expect(
      tool.run({
        input: {
          query: "startup compliance",
          scope: "both",
          limit: 4,
        },
      }),
    ).rejects.toThrow();

    expect(searchFirmKnowledge).not.toHaveBeenCalled();
    expect(searchLegalKnowledge).not.toHaveBeenCalled();
  });

  it("still allows firm searches for non-Nigerian firms", async () => {
    vi.mocked(searchFirmKnowledge).mockResolvedValue({
      status: "ok",
      results: [{ title: "Company overview", text: "Firm evidence." }],
    });

    const tool = createSearchKnowledgeTool("demo-law", "browser-1", false);
    const result = await tool.run({
      input: {
        query: "who can help?",
        scope: "firm",
        limit: 4,
      },
    });

    expect(searchFirmKnowledge).toHaveBeenCalledTimes(1);
    expect(searchLegalKnowledge).not.toHaveBeenCalled();
    expect(result.status).toBe("ok");
  });
});
