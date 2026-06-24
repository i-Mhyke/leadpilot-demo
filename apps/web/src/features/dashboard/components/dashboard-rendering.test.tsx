import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BookingRequestItem, FirmBookingDetail, FirmDashboardOverview } from "@leadpilot/shared";
import { CONVERSATION_CONTEXT_PREVIEW_LIMIT } from "@leadpilot/shared";
import { BookingDetail } from "./booking-detail";
import { BookingRequests } from "./booking-requests";
import { ConversationLeads } from "./conversation-leads";
import { ConversationContextPanel } from "./conversation-context-panel";
import { DashboardOverview } from "./dashboard-overview";
import { DashboardShell } from "./dashboard-shell";
import { DashboardState } from "./dashboard-state";
import { MetricTile } from "./metric-tile";
import { formatDashboardWhen } from "../dashboard-utils";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    activeProps,
    className,
    params,
  }: {
    children: ReactNode;
    to: string;
    activeProps?: { className?: string };
    className?: string;
    params?: { firmSlug: string; conversationId?: string };
  }) => {
    let href = to;
    if (params?.firmSlug) href = href.replace("$firmSlug", params.firmSlug);
    if (params?.conversationId) href = href.replace("$conversationId", params.conversationId);
    return (
      <a href={href} className={activeProps?.className ?? className}>
        {children}
      </a>
    );
  },
  useNavigate: () => () => undefined,
}));

const overview: FirmDashboardOverview = {
  firm: {
    id: "firm-a",
    name: "Harbor & Vale Legal",
    slug: "demo-law",
    industry: "legal",
    status: "active",
  },
  metrics: {
    conversationsTotal: 0,
    conversationsToday: 0,
    newLeads: 0,
    bookingRequests: 0,
    recentTopics: [],
  },
  recentConversations: [],
};

const sampleBooking: BookingRequestItem = {
  id: "booking-1",
  conversationId: "conv-1",
  status: "requested",
  visitorName: "Maren Okonkwo",
  visitorEmail: "maren@northline.io",
  preferredBookingAt: "2026-01-02T10:30:00.000Z",
  matterSummary: "SAFE note fundraising",
  leadBrief: "Founder exploring seed terms",
  createdAt: "2026-01-02T10:00:00.000Z",
};

const sampleDetail: FirmBookingDetail = {
  conversationId: "conv-1",
  booking: {
    id: "booking-1",
    firmId: "firm-a",
    conversationId: "conv-1",
    status: "requested",
    visitorName: "Maren Okonkwo",
    visitorEmail: "maren@northline.io",
    preferredBookingAt: "2026-01-02T10:30:00.000Z",
    matterSummary: "SAFE note fundraising",
    leadBrief: "Founder exploring seed terms",
    createdAt: "2026-01-02T10:00:00.000Z",
    updatedAt: "2026-01-02T10:00:00.000Z",
  },
  messages: Array.from({ length: CONVERSATION_CONTEXT_PREVIEW_LIMIT }, (_, index) => ({
    id: `msg-${index}`,
    role: index % 2 === 0 ? ("visitor" as const) : ("assistant" as const),
    content: index % 2 === 0 ? "We need help with our seed round." : "Happy to help review terms.",
    createdAt: `2026-01-02T10:0${index}:00.000Z`,
  })),
  messageCount: 42,
};

const sampleLead = {
  conversationId: "conv-1",
  visitorId: "visitor-1",
  visitorLabel: "Maren Okonkwo",
  visitorName: "Maren Okonkwo",
  visitorEmail: "maren@northline.io",
  visitorPhone: undefined,
  companyName: "Northline Labs",
  matterSummary: "SAFE note fundraising",
  preferredBookingAt: "2026-01-02T10:30:00.000Z",
  phase: "qualify" as const,
  status: "open" as const,
  sourceUrl: "https://example.com/pricing",
  lastMessageAt: "2026-01-02T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
  messageCount: 6,
  topics: ["SAFE notes"],
  lead: {
    status: "new" as const,
    temperature: "warm" as const,
    score: 72,
    summary: "Founder exploring seed terms",
  },
  bookingStatus: "requested" as const,
};

describe("dashboard rendering", () => {
  it("shouldRenderDashboardShellWithoutLegacyClasses", () => {
    const { container } = render(
      <DashboardShell firmSlug="demo-law" overview={overview}>
        <div>Body</div>
      </DashboardShell>,
    );

    expect(container.querySelector(".page")).toBeNull();
    expect(container.querySelector(".topbar")).toBeNull();
    expect(container.querySelector(".hero")).toBeNull();
    expect(screen.getByText("Harbor & Vale Legal")).toBeInTheDocument();
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Leads")).toBeInTheDocument();
    expect(screen.getByText("Conversations")).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
    expect(container.querySelector(".min-h-dvh")).toBeTruthy();
  });

  it("shouldRenderNotFoundDashboardState", () => {
    render(
      <DashboardState
        title="Firm not found"
        description='No active dashboard is available for "missing".'
      />,
    );
    expect(screen.getByText("Firm not found")).toBeInTheDocument();
  });

  it("shouldRenderEmptyMetricsState", () => {
    render(<DashboardOverview overview={overview} firmSlug="demo-law" />);
    expect(screen.getByText(/no conversations yet/i)).toBeInTheDocument();
    expect(screen.getByText(/no topics tracked/i)).toBeInTheDocument();
  });

  it("shouldRenderMetricTilesWithAccessibleLabels", () => {
    render(
      <div>
        <MetricTile label="Conversations" value={12} hint="2 started today" />
      </div>,
    );
    expect(screen.getByText("Conversations")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("shouldRenderRequestedBookingAsUnconfirmed", () => {
    render(<BookingRequests firmSlug="demo-law" bookings={[sampleBooking]} />);
    expect(screen.getByText("Request received")).toBeInTheDocument();
    expect(screen.queryByText(/confirmed/i)).toBeNull();
  });

  it("shouldRenderMissingOptionalContactFields", () => {
    render(
      <BookingRequests
        firmSlug="demo-law"
        bookings={[
          {
            ...sampleBooking,
            visitorName: undefined,
            visitorEmail: undefined,
            visitorPhone: undefined,
            preferredBookingAt: undefined,
            preferredTimeText: undefined,
          },
        ]}
      />,
    );
    expect(screen.getByText("No email yet")).toBeInTheDocument();
    expect(screen.getByText("No phone yet")).toBeInTheDocument();
    expect(screen.getByText("Preferred time not provided")).toBeInTheDocument();
  });

  it("shouldRenderPreferredBookingDateTimeWhenStructuredValueExists", () => {
    render(<BookingRequests firmSlug="demo-law" bookings={[sampleBooking]} />);
    expect(
      screen.getByText(`Structured booking time: ${formatDashboardWhen(sampleBooking.preferredBookingAt)}`),
    ).toBeInTheDocument();
  });

  it("shouldRenderStructuredBookingDatetimeOnLeadRows", () => {
    render(<ConversationLeads firmSlug="demo-law" leads={[sampleLead]} />);
    expect(screen.getByText("Booking linked")).toBeInTheDocument();
    expect(screen.getByText(sampleLead.visitorLabel)).toBeInTheDocument();
  });

  it("shouldNotRenderReasoningMessages", () => {
    const messages = [
      {
        id: "msg-1",
        role: "visitor" as const,
        content: "We need help with our seed round.",
        createdAt: "2026-01-02T10:00:00.000Z",
      },
      {
        id: "msg-2",
        role: "assistant" as const,
        content: "Happy to help review terms.",
        createdAt: "2026-01-02T10:01:00.000Z",
      },
    ];
    render(
      <ConversationContextPanel
        messages={messages}
        messageCount={2}
        previewLimit={CONVERSATION_CONTEXT_PREVIEW_LIMIT}
      />,
    );
    expect(screen.getByText("We need help with our seed round.")).toBeInTheDocument();
    expect(screen.getByText("Happy to help review terms.")).toBeInTheDocument();
    expect(screen.queryByText(/reasoning/i)).toBeNull();
    expect(screen.queryByText(/tool/i)).toBeNull();
  });

  it("shouldKeepConversationContextPreviewBounded", () => {
    const { container } = render(
      <ConversationContextPanel
        messages={sampleDetail.messages}
        messageCount={sampleDetail.messageCount}
        previewLimit={CONVERSATION_CONTEXT_PREVIEW_LIMIT}
      />,
    );
    expect(container.textContent).toMatch(/8 of 42 messages/);
  });

  it("shouldRenderLeadAndBookingRowsWithoutMarketingCards", () => {
    const { container } = render(<BookingRequests firmSlug="demo-law" bookings={[sampleBooking]} />);
    expect(container.querySelector(".hero")).toBeNull();
    expect(container.querySelector(".card")).toBeNull();
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/dashboard/demo-law/leads/conv-1",
    );
  });

  it("shouldShowBookingLeadBriefOnDetailPage", () => {
    render(<BookingDetail firmSlug="demo-law" detail={sampleDetail} />);
    expect(screen.getByText("Founder exploring seed terms")).toBeInTheDocument();
    expect(screen.queryByText("Preferred time not provided")).toBeNull();
    expect(screen.getByText("Structured booking time")).toBeInTheDocument();
    expect(screen.getByText(formatDashboardWhen(sampleDetail.booking.preferredBookingAt))).toBeInTheDocument();
  });
});
