import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { ContentInsightActionResult, FirmContentRecommendation } from "@leadpilot/shared";
import { ContentRecommendations } from "./content-recommendations";

const serverFns = vi.hoisted(() => ({
  runAnalysis: vi.fn() as Mock<() => Promise<ContentInsightActionResult>>,
  refreshRecommendations: vi.fn() as Mock,
}));

vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: unknown) => {
    if (fn === "runContentInsightAnalysis") return serverFns.runAnalysis;
    return serverFns.refreshRecommendations;
  },
}));

vi.mock("@/features/dashboard/content-intelligence-actions", () => ({
  runContentInsightAnalysis: "runContentInsightAnalysis",
  getFirmContentRecommendations: "getFirmContentRecommendations",
}));

const sampleRecommendations: FirmContentRecommendation[] = [
  {
    id: "rec-1",
    firmId: "firm-a",
    topic: "SAFE notes",
    format: "blog_post",
    title: "Content draft: SAFE notes",
    rationale: "Visitors discussed SAFE notes.",
    sourceConversationCount: 3,
    status: "draft",
    createdAt: "2026-01-01T00:00:00.000Z",
    draft: "Draft outline",
  },
  {
    id: "rec-2",
    firmId: "firm-a",
    topic: "NDPA",
    format: "video_brief",
    title: "Video brief: NDPA",
    rationale: "Visitors discussed NDPA.",
    sourceConversationCount: 4,
    status: "draft",
    createdAt: "2026-01-02T00:00:00.000Z",
    draft: "Video brief outline",
  },
];

const contentProps = {
  firmSlug: "demo-law",
  defaultRangeDays: 30,
  initialFrom: "2026-01-01T00:00:00.000Z",
  initialTo: "2026-01-31T00:00:00.000Z",
} as const;

describe("ContentRecommendations", () => {
  beforeEach(() => {
    serverFns.runAnalysis.mockReset();
    serverFns.refreshRecommendations.mockReset();
    serverFns.refreshRecommendations.mockResolvedValue({
      kind: "ok",
      recommendations: sampleRecommendations,
    });
  });

  it("shouldRenderRunAnalysisButton", () => {
    render(<ContentRecommendations {...contentProps} initialRecommendations={[]} />);
    expect(screen.getByRole("button", { name: /run analysis/i })).toBeInTheDocument();
  });

  it("shouldRenderNotEnoughDataMessage", async () => {
    const user = userEvent.setup();
    serverFns.runAnalysis.mockResolvedValue({
      kind: "not_enough_data",
      conversationCount: 2,
      message: "At least 3 conversations are required. Found 2.",
    });

    render(<ContentRecommendations {...contentProps} initialRecommendations={[]} />);
    await user.click(screen.getByRole("button", { name: /run analysis/i }));

    expect(await screen.findByText(/at least 3 conversations are required/i)).toBeInTheDocument();
  });

  it("shouldRenderTimeframeScope", () => {
    render(<ContentRecommendations {...contentProps} initialRecommendations={[]} />);
    expect(screen.getByRole("group", { name: /analysis date range/i })).toBeInTheDocument();
    expect(screen.getByText(/scoped to/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /last 30 days/i })).toBeInTheDocument();
  });

  it("shouldRenderEmptyRunMessage", async () => {
    const user = userEvent.setup();
    serverFns.runAnalysis.mockResolvedValue({
      kind: "empty",
      message: "No conversations were found in the selected date range.",
    });

    render(<ContentRecommendations {...contentProps} initialRecommendations={[]} />);
    await user.click(screen.getByRole("button", { name: /run analysis/i }));

    expect(
      await screen.findByText(/no conversations were found in the selected date range/i),
    ).toBeInTheDocument();
  });

  it("shouldRenderFailedRunMessage", async () => {
    const user = userEvent.setup();
    serverFns.runAnalysis.mockResolvedValue({
      kind: "failed",
      runId: "run-1",
      message: "Content insight run failed while saving recommendations.",
    });

    render(<ContentRecommendations {...contentProps} initialRecommendations={[]} />);
    await user.click(screen.getByRole("button", { name: /run analysis/i }));

    expect(
      await screen.findByText(/content insight run failed while saving recommendations/i),
    ).toBeInTheDocument();
  });

  it("shouldRenderDraftRecommendationStatus", () => {
    render(
      <ContentRecommendations {...contentProps} initialRecommendations={sampleRecommendations} />,
    );
    expect(screen.getAllByText("Draft").length).toBeGreaterThan(0);
    expect(screen.getByText("Content draft: SAFE notes")).toBeInTheDocument();
  });

  it("shouldNotRenderGeneratedVideoClaim", () => {
    render(
      <ContentRecommendations {...contentProps} initialRecommendations={sampleRecommendations} />,
    );
    expect(screen.queryByText(/video generated/i)).not.toBeInTheDocument();
    expect(screen.getByText(/video idea brief only/i)).toBeInTheDocument();
  });

  it("shouldDisableRunAnalysisButtonWhileRunning", async () => {
    const user = userEvent.setup();
    let resolveRun: (value: ContentInsightActionResult) => void = () => {};
    serverFns.runAnalysis.mockImplementation(
      () =>
        new Promise<ContentInsightActionResult>((resolve) => {
          resolveRun = resolve;
        }),
    );

    render(<ContentRecommendations {...contentProps} initialRecommendations={[]} />);
    const button = screen.getByRole("button", { name: /run analysis/i });
    await user.click(button);

    expect(button).toBeDisabled();
    expect(screen.getByRole("button", { name: /analyzing conversations/i })).toBeDisabled();

    resolveRun({
      kind: "empty",
      message: "No conversations were found in the selected date range.",
    });
    expect(await screen.findByText(/no conversations were found/i)).toBeInTheDocument();
  });

  it("shouldRenderInlineRunResultMessage", async () => {
    const user = userEvent.setup();
    serverFns.runAnalysis.mockResolvedValue({
      kind: "completed",
      runId: "run-9",
      savedRecommendationCount: 2,
      message: "Saved 2 draft recommendation(s) from 4 conversation(s).",
    });

    render(<ContentRecommendations {...contentProps} initialRecommendations={[]} />);
    await user.click(screen.getByRole("button", { name: /run analysis/i }));

    expect(
      await screen.findByText(/saved 2 draft recommendation\(s\) from 4 conversation\(s\)/i),
    ).toBeInTheDocument();
  });

  it("shouldFollowDashboardDesignContract", async () => {
    const user = userEvent.setup();
    serverFns.runAnalysis.mockResolvedValue({
      kind: "failed",
      runId: "run-1",
      message: "Content insight run failed while saving recommendations.",
    });

    const { container } = render(
      <ContentRecommendations {...contentProps} initialRecommendations={sampleRecommendations} />,
    );

    const button = screen.getByRole("button", { name: /run analysis/i });
    expect(button.className).toMatch(/rounded-full/);
    expect(button.className).toMatch(/active:scale-\[0\.98\]/);
    expect(screen.getByText("Content draft: SAFE notes")).toBeInTheDocument();

    await user.click(button);
    const status = await screen.findByRole("status");
    expect(status.className).not.toMatch(/destructive/);
    expect(status.className).toMatch(/text-muted-foreground/);
    expect(screen.queryByText(/agent|eve|generating video/i)).not.toBeInTheDocument();
    expect(container.querySelector("[class*='divide-y']")).toBeTruthy();
  });

  it("shouldKeepExistingRecommendationsVisibleWhileRunning", async () => {
    const user = userEvent.setup();
    serverFns.runAnalysis.mockImplementation(
      () =>
        new Promise<ContentInsightActionResult>(() => {
          /* pending */
        }),
    );

    render(
      <ContentRecommendations {...contentProps} initialRecommendations={sampleRecommendations} />,
    );
    await user.click(screen.getByRole("button", { name: /run analysis/i }));

    expect(await screen.findByRole("button", { name: /analyzing conversations/i })).toBeDisabled();
    expect(screen.getByText("Content draft: SAFE notes")).toBeInTheDocument();
    expect(screen.queryByLabelText(/loading recommendations/i)).not.toBeInTheDocument();
  });
});

describe("content intelligence server action guardrails", () => {
  it("shouldNotCallEveOrAgentRuntime", () => {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(
      resolve(__dirname, "../content-intelligence-actions.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/apps\/agent/);
    expect(source).not.toMatch(/conversation-analyst/);
    expect(source).not.toMatch(/\/eve/);
    expect(source).toContain("runOnDemandContentInsight");
  });
});
