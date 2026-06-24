import { beforeEach, describe, expect, it, vi } from "vitest";
import { setSqlForTests } from "./client.ts";
import {
  FirmBrainCompilationError,
  compileFirmBrainMarkdown,
  deriveSuggestedQuestions,
  saveFirmBrainConfig,
} from "./firm-brain.ts";

describe("firm brain compilation", () => {
  it("compiles the structured markdown template into runtime slots", () => {
    const result = compileFirmBrainMarkdown(`
# Firm brain

## Business summary
Northline Advisory is a consulting firm that helps prospects get oriented quickly.

## Tone
- Voice: warm and direct
- Formality: balanced
- Preferred greeting: Hi, I'm the intake assistant for Northline Advisory.
- Avoid: jargon

## Greeting
Open with a short welcome and one question.

## Qualification posture
- Ask what they need help with.
- Keep the first pass lightweight.

## Escalation rules
- Escalate legal issues to a human.

## Forbidden claims
- Never promise outcomes.

## Service emphasis
- Lead qualification
- Booking requests

## Qualification hints
- Ask what they need help with before offering any guidance.
- Confirm whether the matter is a transaction, dispute, or advisory request.
- Use the public practice areas to narrow the first follow-up question.

## Suggested initial questions
- What data protection regulations should I consider for my fintech?
- How should I structure this M&A transaction to reduce closing risk?
- When should a contract dispute be escalated to litigation or arbitration?
`);

    expect(result.compiled.businessSummary).toContain("Northline Advisory");
    expect(result.compiled.tone.voice).toBe("warm and direct");
    expect(result.compiled.tone.formalityLevel).toBe("balanced");
    expect(result.compiled.tone.preferredGreeting).toContain("Northline Advisory");
    expect(result.compiled.tone.notes).toContain("Avoid: jargon");
    expect(result.compiled.greeting).toContain("short welcome");
    expect(result.compiled.qualificationPosture).toEqual([
      "Ask what they need help with.",
      "Keep the first pass lightweight.",
    ]);
    expect(result.compiled.escalationRules).toEqual(["Escalate legal issues to a human."]);
    expect(result.compiled.forbiddenClaims).toEqual(["Never promise outcomes."]);
    expect(result.compiled.serviceEmphasis).toEqual(["Lead qualification", "Booking requests"]);
    expect(result.compiled.qualificationHints).toEqual([
      "Ask what they need help with before offering any guidance.",
      "Confirm whether the matter is a transaction, dispute, or advisory request.",
      "Use the public practice areas to narrow the first follow-up question.",
    ]);
    expect(result.compiled.suggestedQuestions).toEqual([
      "What data protection regulations should I consider for my fintech?",
      "How should I structure this M&A transaction to reduce closing risk?",
      "When should a contract dispute be escalated to litigation or arbitration?",
    ]);
  });

  it("derives conservative starter questions from a firm profile", () => {
    const questions = deriveSuggestedQuestions({
      firm: {
        name: "Northline Advisory",
        industry: "consulting",
      },
      services: [
        {
          name: "Transactions",
          qualificationQuestions: ["What type of transaction is this?"],
          visitorExamples: [],
          isActive: true,
        },
      ],
    });

    expect(questions).toEqual([
      "What type of transaction is this?",
      "What should a consulting business prepare before the first call?",
      "Which facts decide whether this is a fit?",
    ]);
  });

  it("rejects freeform markdown without a recognized template section", () => {
    expect(() => compileFirmBrainMarkdown("Just a paragraph.")).toThrow(
      FirmBrainCompilationError,
    );
  });
});

describe("firm brain persistence", () => {
  beforeEach(() => {
    setSqlForTests(null);
  });

  it("is idempotent for the same content hash and returns the current revision", async () => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([
        {
          name: "Northline Advisory",
          industry: "consulting",
        },
      ])
      .mockResolvedValueOnce([
        {
          name: "Transactions",
          qualification_questions: ["What type of transaction is this?"],
          visitor_examples: [],
          is_active: true,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "brain-1",
          firm_id: "firm-a",
          source_filename: "brain.md",
          raw_markdown: "# Brain",
          content_hash: "hash-1",
          revision: 2,
          compiled_json: {
            businessSummary: "Northline Advisory is a consulting firm.",
            tone: { notes: [] },
            qualificationPosture: [],
            escalationRules: [],
            forbiddenClaims: [],
            serviceEmphasis: [],
          },
          compiled_at: "2026-06-24T00:00:00.000Z",
          created_at: "2026-06-24T00:00:00.000Z",
          updated_at: "2026-06-24T00:00:00.000Z",
        },
      ]);
    setSqlForTests(sql as never);

    const result = await saveFirmBrainConfig({
      firmId: "firm-a",
      sourceFilename: "brain.md",
      contentMarkdown: `
## Business summary
Northline Advisory is a consulting firm.
`,
    });

    expect(result.revision).toBe(2);
    expect(String(sql.mock.calls[2]?.[0])).toContain("ON CONFLICT (firm_id) DO UPDATE");
    expect(String(sql.mock.calls[2]?.[0])).toContain(
      "firm_brains.content_hash IS DISTINCT FROM EXCLUDED.content_hash",
    );
    expect(String(sql.mock.calls[2]?.[5] ?? "")).toContain("suggestedQuestions");
    expect(sql).toHaveBeenCalledTimes(3);
  });

  it("bumps the revision when the brain content changes", async () => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([
        {
          name: "Northline Advisory",
          industry: "consulting",
        },
      ])
      .mockResolvedValueOnce([
        {
          name: "Transactions",
          qualification_questions: ["What type of transaction is this?"],
          visitor_examples: [],
          is_active: true,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "brain-1",
          firm_id: "firm-a",
          source_filename: "brain.md",
          raw_markdown: "# Brain",
          content_hash: "hash-2",
          revision: 3,
          compiled_json: {
            businessSummary: "Northline Advisory is a consulting firm.",
            tone: { notes: [] },
            qualificationPosture: [],
            escalationRules: [],
            forbiddenClaims: [],
            serviceEmphasis: [],
          },
          compiled_at: "2026-06-24T00:00:00.000Z",
          created_at: "2026-06-24T00:00:00.000Z",
          updated_at: "2026-06-24T00:00:00.000Z",
        },
      ]);
    setSqlForTests(sql as never);

    const result = await saveFirmBrainConfig({
      firmId: "firm-a",
      sourceFilename: "brain.md",
      contentMarkdown: `
## Business summary
Northline Advisory is a consulting firm with a sharper intake flow.
`,
    });

    expect(result.revision).toBe(3);
    expect(String(sql.mock.calls[2]?.[0])).toContain("revision = firm_brains.revision + 1");
    expect(String(sql.mock.calls[2]?.[0])).toContain("compiled_json");
  });

  it("persists starter questions from the suggested initial questions section", async () => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([
        {
          name: "Northline Advisory",
          industry: "consulting",
        },
      ])
      .mockResolvedValueOnce([
        {
          name: "Transactions",
          qualification_questions: [],
          visitor_examples: [],
          is_active: true,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "brain-1",
          firm_id: "firm-a",
          source_filename: "brain.md",
          raw_markdown: "# Brain",
          content_hash: "hash-3",
          revision: 4,
          compiled_json: {
            businessSummary: "Northline Advisory is a consulting firm.",
            tone: { notes: [] },
            qualificationPosture: [],
            qualificationHints: [
              "Ask what they need help with before offering any guidance.",
            ],
            escalationRules: [],
            forbiddenClaims: [],
            serviceEmphasis: [],
            suggestedQuestions: [
              "What data protection regulations should I consider for my fintech?",
              "How should I structure this M&A transaction to reduce closing risk?",
              "When should a contract dispute be escalated to litigation or arbitration?",
            ],
          },
          compiled_at: "2026-06-24T00:00:00.000Z",
          created_at: "2026-06-24T00:00:00.000Z",
          updated_at: "2026-06-24T00:00:00.000Z",
        },
      ]);
    setSqlForTests(sql as never);

    const result = await saveFirmBrainConfig({
      firmId: "firm-a",
      sourceFilename: "brain.md",
      contentMarkdown: `
## Business summary
Northline Advisory is a consulting firm.

## Qualification hints
- Ask what they need help with before offering any guidance.

## Suggested initial questions
- What data protection regulations should I consider for my fintech?
- How should I structure this M&A transaction to reduce closing risk?
- When should a contract dispute be escalated to litigation or arbitration?
`,
    });

    expect(result.compiled.suggestedQuestions).toEqual([
      "What data protection regulations should I consider for my fintech?",
      "How should I structure this M&A transaction to reduce closing risk?",
      "When should a contract dispute be escalated to litigation or arbitration?",
    ]);
    expect(String(sql.mock.calls[2]?.[5] ?? "")).toContain(
      "What data protection regulations should I consider for my fintech?",
    );
  });
});
