import { describe, expect, it, vi, beforeEach } from "vitest";
import { setSqlForTests } from "./client.ts";
import {
  CONVERSATION_CONTEXT_PREVIEW_LIMIT,
  getFirmBookingDetailBySlug,
  getFirmDashboardOverviewBySlug,
  listFirmBookingRequestItemsBySlug,
  listFirmConversationLeadsBySlug,
} from "./dashboard.ts";

vi.mock("./firms.ts", () => ({
  getFirmBySlug: vi.fn(),
}));

import { getFirmBySlug } from "./firms.ts";

const activeFirm = {
  id: "firm-a",
  name: "Demo Law",
  slug: "demo-law",
  industry: "legal" as const,
  status: "active" as const,
};

describe("firm dashboard read model", () => {
  beforeEach(() => {
    setSqlForTests(null);
    vi.clearAllMocks();
  });

  it("shouldResolveDashboardByFirmSlug", async () => {
    vi.mocked(getFirmBySlug).mockResolvedValue(activeFirm);
    const sql = vi
      .fn()
      .mockResolvedValueOnce([{ count: "12" }])
      .mockResolvedValueOnce([{ count: "2" }])
      .mockResolvedValueOnce([{ count: "4" }])
      .mockResolvedValueOnce([{ count: "1" }])
      .mockResolvedValueOnce([{ topic: "SAFE notes", topic_count: "3" }])
      .mockResolvedValueOnce([
        {
          id: "conv-1",
          matter_summary: "Fundraising",
          phase: "qualify",
          status: "open",
          last_message_at: "2026-01-02T00:00:00.000Z",
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ]);
    setSqlForTests(sql as never);

    const result = await getFirmDashboardOverviewBySlug("demo-law");
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.overview.firm.slug).toBe("demo-law");
      expect(result.overview.metrics.conversationsTotal).toBe(12);
    }
  });

  it("shouldOnlyCountRowsForResolvedFirm", async () => {
    vi.mocked(getFirmBySlug).mockResolvedValue(activeFirm);
    const sql = vi
      .fn()
      .mockResolvedValueOnce([{ count: "1" }])
      .mockResolvedValueOnce([{ count: "0" }])
      .mockResolvedValueOnce([{ count: "0" }])
      .mockResolvedValueOnce([{ count: "0" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    setSqlForTests(sql as never);

    await getFirmDashboardOverviewBySlug("demo-law");
    expect(sql).toHaveBeenCalled();
  });

  it("shouldReturnNotFoundForUnknownFirm", async () => {
    vi.mocked(getFirmBySlug).mockResolvedValue({ kind: "not_found", slug: "missing" });
    const sql = vi.fn();
    setSqlForTests(sql as never);

    const result = await getFirmDashboardOverviewBySlug("missing");
    expect(result.kind).toBe("not_found");
    expect(sql).not.toHaveBeenCalled();
  });

  it("shouldReturnNotFoundForInactiveFirm", async () => {
    vi.mocked(getFirmBySlug).mockResolvedValue({ kind: "inactive", slug: "demo-law" });
    const sql = vi.fn();
    setSqlForTests(sql as never);

    const result = await getFirmDashboardOverviewBySlug("demo-law");
    expect(result.kind).toBe("inactive");
    expect(sql).not.toHaveBeenCalled();
  });

  it("shouldReturnRecentConversationsForFirm", async () => {
    vi.mocked(getFirmBySlug).mockResolvedValue(activeFirm);
    const sql = vi
      .fn()
      .mockResolvedValueOnce([{ count: "3" }])
      .mockResolvedValueOnce([{ count: "0" }])
      .mockResolvedValueOnce([{ count: "0" }])
      .mockResolvedValueOnce([{ count: "0" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "conv-1",
          matter_summary: "Fundraising",
          phase: "qualify",
          status: "open",
          last_message_at: "2026-01-02T00:00:00.000Z",
          created_at: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "conv-2",
          matter_summary: "NDPA review",
          phase: "listen",
          status: "open",
          last_message_at: "2026-01-03T00:00:00.000Z",
          created_at: "2026-01-02T00:00:00.000Z",
        },
      ]);
    setSqlForTests(sql as never);

    const result = await getFirmDashboardOverviewBySlug("demo-law");
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.overview.recentConversations).toHaveLength(2);
      expect(result.overview.recentConversations[0]?.id).toBe("conv-1");
      expect(result.overview.recentConversations[0]?.matterSummary).toBe("Fundraising");
    }
  });

  it("shouldReturnZeroMetricsForFirmWithNoActivity", async () => {
    vi.mocked(getFirmBySlug).mockResolvedValue(activeFirm);
    const sql = vi
      .fn()
      .mockResolvedValueOnce([{ count: "0" }])
      .mockResolvedValueOnce([{ count: "0" }])
      .mockResolvedValueOnce([{ count: "0" }])
      .mockResolvedValueOnce([{ count: "0" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    setSqlForTests(sql as never);

    const result = await getFirmDashboardOverviewBySlug("demo-law");
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.overview.metrics.conversationsTotal).toBe(0);
      expect(result.overview.metrics.conversationsToday).toBe(0);
      expect(result.overview.metrics.newLeads).toBe(0);
      expect(result.overview.metrics.bookingRequests).toBe(0);
      expect(result.overview.recentConversations).toHaveLength(0);
    }
  });

  it("shouldListConversationLeadsForFirm", async () => {
    vi.mocked(getFirmBySlug).mockResolvedValue(activeFirm);
    const sql = vi.fn().mockResolvedValueOnce([
      {
        conversation_id: "conv-1",
        visitor_id: "visitor-1",
        visitor_name: "Maren Okonkwo",
        visitor_email: "maren@northline.io",
        visitor_phone: null,
        company_name: "Northline Labs",
        anonymous_key: null,
        matter_summary: "SAFE note fundraising",
        phase: "qualify",
        status: "open",
        source_url: "https://example.com/pricing",
        last_message_at: "2026-01-02T00:00:00.000Z",
        created_at: "2026-01-01T00:00:00.000Z",
        message_count: "6",
        topics: ["SAFE notes"],
        lead_status: "new",
        lead_temperature: "warm",
        lead_score: 72,
        lead_summary: "Founder exploring seed terms",
        booking_status: "requested",
        preferred_booking_at: "2026-01-02T10:30:00.000Z",
      },
    ]);
    setSqlForTests(sql as never);

    const result = await listFirmConversationLeadsBySlug("demo-law");
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.leads[0]?.visitorLabel).toBe("Maren Okonkwo");
      expect(result.leads[0]?.topics).toContain("SAFE notes");
      expect(result.leads[0]?.lead?.score).toBe(72);
      expect(result.leads[0]?.bookingStatus).toBe("requested");
      expect(result.leads[0]?.preferredBookingAt).toBe("2026-01-02T10:30:00.000Z");
    }
  });

  it("shouldNotIncludeConversationMessagesInOverview", async () => {
    vi.mocked(getFirmBySlug).mockResolvedValue(activeFirm);
    const sql = vi
      .fn()
      .mockResolvedValueOnce([{ count: "0" }])
      .mockResolvedValueOnce([{ count: "0" }])
      .mockResolvedValueOnce([{ count: "0" }])
      .mockResolvedValueOnce([{ count: "0" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "conv-1",
          matter_summary: "NDPA",
          phase: "listen",
          status: "open",
          last_message_at: null,
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ]);
    setSqlForTests(sql as never);

    const result = await getFirmDashboardOverviewBySlug("demo-law");
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.overview.recentConversations[0]).not.toHaveProperty("messages");
    }
  });

  it("shouldListOnlyFirmBookingRequests", async () => {
    vi.mocked(getFirmBySlug).mockResolvedValue(activeFirm);
    const sql = vi.fn().mockResolvedValueOnce([
      {
        id: "booking-1",
        conversation_id: "conv-1",
        status: "requested",
        visitor_name: "Maren Okonkwo",
        visitor_email: "maren@northline.io",
        visitor_phone: null,
        company_name: "Northline Labs",
        matter_summary: "SAFE note fundraising",
        lead_brief: "Founder exploring seed terms",
        preferred_time_text: "Next Tuesday morning",
        urgency: "medium",
        created_at: "2026-01-02T00:00:00.000Z",
        preferred_booking_at: "2026-01-02T10:30:00.000Z",
      },
    ]);
    setSqlForTests(sql as never);

    const result = await listFirmBookingRequestItemsBySlug("demo-law");
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.bookings).toHaveLength(1);
      expect(result.bookings[0]?.id).toBe("booking-1");
      expect(result.bookings[0]?.conversationId).toBe("conv-1");
      expect(result.bookings[0]?.preferredBookingAt).toBe("2026-01-02T10:30:00.000Z");
    }
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it("shouldIncludeLeadBriefForBookings", async () => {
    vi.mocked(getFirmBySlug).mockResolvedValue(activeFirm);
    const sql = vi.fn().mockResolvedValueOnce([
      {
        id: "booking-1",
        conversation_id: "conv-1",
        status: "requested",
        visitor_name: null,
        visitor_email: null,
        visitor_phone: null,
        company_name: null,
        matter_summary: "NDPA review",
        lead_brief: "Startup needs vendor contract review before launch",
        preferred_time_text: null,
        urgency: null,
        created_at: "2026-01-02T00:00:00.000Z",
      },
    ]);
    setSqlForTests(sql as never);

    const result = await listFirmBookingRequestItemsBySlug("demo-law");
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.bookings[0]?.leadBrief).toBe(
        "Startup needs vendor contract review before launch",
      );
    }
  });

  it("shouldLabelRequestedBookingAsUnconfirmed", async () => {
    vi.mocked(getFirmBySlug).mockResolvedValue(activeFirm);
    const sql = vi.fn().mockResolvedValueOnce([
      {
        id: "booking-1",
        conversation_id: "conv-1",
        status: "requested",
        visitor_name: "Alex",
        visitor_email: "alex@example.com",
        visitor_phone: null,
        company_name: null,
        matter_summary: "Employment dispute",
        lead_brief: "Employee termination review",
        preferred_time_text: "Friday afternoon",
        urgency: "high",
        created_at: "2026-01-02T00:00:00.000Z",
      },
    ]);
    setSqlForTests(sql as never);

    const result = await listFirmBookingRequestItemsBySlug("demo-law");
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.bookings[0]?.status).toBe("requested");
    }
  });

  it("shouldLimitConversationContextMessages", async () => {
    vi.mocked(getFirmBySlug).mockResolvedValue(activeFirm);
    const bookingRow = {
      id: "booking-1",
      firm_id: "firm-a",
      conversation_id: "conv-1",
      lead_id: "lead-1",
      status: "requested",
      service_id: null,
      routing_group: null,
      visitor_name: "Maren",
      visitor_email: "maren@example.com",
      visitor_phone: null,
      company_name: null,
      preferred_time_text: "Monday",
      matter_summary: "Fundraising",
      lead_brief: "Seed round terms",
      urgency: null,
      source_url: null,
      created_at: "2026-01-02T00:00:00.000Z",
      updated_at: "2026-01-02T00:00:00.000Z",
    };
    const previewMessages = Array.from({ length: CONVERSATION_CONTEXT_PREVIEW_LIMIT }, (_, i) => ({
      id: `msg-${i}`,
      role: i % 2 === 0 ? "visitor" : "assistant",
      content: `Message ${i}`,
      created_at: `2026-01-02T00:0${i}:00.000Z`,
    })).reverse();

    const sql = vi
      .fn()
      .mockResolvedValueOnce([{ id: "conv-1" }])
      .mockResolvedValueOnce([bookingRow])
      .mockResolvedValueOnce([
        {
          status: "new",
          temperature: "warm",
          score: 70,
          summary: "Qualified founder",
        },
      ])
      .mockResolvedValueOnce([{ count: "15" }])
      .mockResolvedValueOnce(previewMessages);

    setSqlForTests(sql as never);

    const result = await getFirmBookingDetailBySlug("demo-law", "conv-1");
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.detail.messages).toHaveLength(CONVERSATION_CONTEXT_PREVIEW_LIMIT);
      expect(result.detail.messageCount).toBe(15);
      expect(result.detail.messages.every((m) => m.role === "visitor" || m.role === "assistant")).toBe(
        true,
      );
      expect(result.detail.messages[0]?.content).toBe("Message 0");
    }
  });

  it("shouldScopeBookingDetailToFirm", async () => {
    vi.mocked(getFirmBySlug).mockResolvedValue(activeFirm);
    const sql = vi.fn().mockResolvedValueOnce([]);
    setSqlForTests(sql as never);

    const result = await getFirmBookingDetailBySlug("demo-law", "conv-other-firm");
    expect(result.kind).toBe("not_found_booking");
  });

  it("shouldReturnNotFoundBookingWhenConversationHasNoBooking", async () => {
    vi.mocked(getFirmBySlug).mockResolvedValue(activeFirm);
    const sql = vi
      .fn()
      .mockResolvedValueOnce([{ id: "conv-1" }])
      .mockResolvedValueOnce([]);
    setSqlForTests(sql as never);

    const result = await getFirmBookingDetailBySlug("demo-law", "conv-1");
    expect(result.kind).toBe("not_found_booking");
  });
});
