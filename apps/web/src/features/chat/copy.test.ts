import { describe, expect, it } from "vitest";
import type { FirmBrainConfig } from "@leadpilot/shared";
import { resolveAskPageCopy } from "./copy";

const sampleBrainConfig: FirmBrainConfig = {
  firmId: "firm-1",
  sourceFilename: "firm-brain.md",
  rawMarkdown: "# Brain",
  contentHash: "abc123",
  revision: 2,
  compiled: {
    businessSummary: "Avance Attorneys Ltd is a Finnish business law firm.",
    tone: { notes: [] },
    greeting: "Open with a short welcome.",
    qualificationPosture: [],
    escalationRules: [],
    forbiddenClaims: [],
    serviceEmphasis: [],
    suggestedQuestions: [
      "What kind of transaction is this?",
      "What is the timeline and jurisdiction?",
      "Which counterparties or regulators are involved?",
    ],
  },
  compiledAt: "2026-06-24T00:00:00.000Z",
  createdAt: "2026-06-24T00:00:00.000Z",
  updatedAt: "2026-06-24T00:00:00.000Z",
};

describe("resolveAskPageCopy", () => {
  it("uses persisted brain questions instead of generating them in the frontend", () => {
    const copy = resolveAskPageCopy({
      firmName: "Avance Attorneys Ltd",
      brainConfig: sampleBrainConfig,
    });

    expect(copy.emptyStateTitle).toContain("Avance Attorneys Ltd");
    expect(copy.suggestedPrompts).toEqual(sampleBrainConfig.compiled.suggestedQuestions);
  });

  it("falls back to generic prompts when the brain has no stored questions", () => {
    const copy = resolveAskPageCopy({
      firmName: "Avance Attorneys Ltd",
      brainConfig: {
        ...sampleBrainConfig,
        compiled: {
          ...sampleBrainConfig.compiled,
          suggestedQuestions: undefined,
        },
      },
    });

    expect(copy.suggestedPrompts).toHaveLength(3);
    expect(copy.suggestedPrompts[0]).toMatch(/prepare before the first call/i);
  });
});
