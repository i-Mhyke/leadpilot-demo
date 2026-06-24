import { describe, expect, it, vi, beforeEach } from "vitest";
import { setSqlForTests } from "./client.ts";
import { createBookingRequest, findOpenBookingRequest, upsertLeadProfile } from "./leads.ts";

describe("lead and booking persistence", () => {
  beforeEach(() => {
    setSqlForTests(null);
  });

  it("returns an existing open booking request for the same conversation", async () => {
    const sql = vi.fn().mockResolvedValue([
      {
        id: "booking-1",
        firm_id: "firm-a",
        conversation_id: "conv-1",
        lead_id: "lead-1",
        status: "requested",
        service_id: null,
        routing_group: null,
        visitor_name: "Amara",
        visitor_email: "lead@example.com",
        visitor_phone: null,
        company_name: null,
        preferred_booking_at: null,
        preferred_time_text: null,
        matter_summary: "SAFE review",
        lead_brief: "Brief",
        urgency: null,
        source_url: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ]);
    setSqlForTests(sql as never);

    const booking = await findOpenBookingRequest("firm-a", "conv-1");
    expect(booking?.id).toBe("booking-1");
    expect(booking?.status).toBe("requested");
  });

  it("does not insert a duplicate open booking request for the same conversation", async () => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: "booking-1",
          firm_id: "firm-a",
          conversation_id: "conv-1",
          lead_id: "lead-1",
          status: "requested",
          service_id: null,
          routing_group: null,
          visitor_name: "Amara",
          visitor_email: "lead@example.com",
          visitor_phone: null,
          company_name: null,
          preferred_booking_at: null,
          preferred_time_text: null,
          matter_summary: "SAFE review",
          lead_brief: "Brief",
          urgency: null,
          source_url: null,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ]);
    setSqlForTests(sql as never);

    const booking = await createBookingRequest({
      firmId: "firm-a",
      conversationId: "conv-1",
      matterSummary: "SAFE review",
      leadBrief: "Brief",
    });

    expect(booking.id).toBe("booking-1");
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it("persists a structured preferred booking datetime on initial booking capture", async () => {
    const leadRow = {
      id: "lead-2",
      firm_id: "firm-a",
      conversation_id: "conv-2",
    };
    const inserted = {
      id: "booking-2",
      firm_id: "firm-a",
      conversation_id: "conv-2",
      lead_id: "lead-2",
      status: "requested",
      service_id: null,
      routing_group: null,
      visitor_name: "Maren",
      visitor_email: "lead@example.com",
      visitor_phone: null,
      company_name: null,
      preferred_booking_at: "2026-01-02T10:30:00.000Z",
      preferred_time_text: null,
      matter_summary: "SAFE review",
      lead_brief: "Brief",
      urgency: null,
      source_url: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };

    const sql = vi
      .fn()
      .mockResolvedValueOnce([leadRow])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([inserted]);
    setSqlForTests(sql as never);

    const booking = await createBookingRequest({
      firmId: "firm-a",
      conversationId: "conv-2",
      leadId: "lead-2",
      visitorName: "Maren",
      visitorEmail: "lead@example.com",
      preferredBookingAt: "2026-01-02T10:30:00.000Z",
      matterSummary: "SAFE review",
      leadBrief: "Brief",
    });

    expect(booking.preferredBookingAt).toBe("2026-01-02T10:30:00.000Z");
    expect(String(sql.mock.calls[2]?.[0])).toContain("preferred_booking_at");
  });

  it("merges optional phone and preferred time into an existing open booking", async () => {
    const existing = {
      id: "booking-1",
      firm_id: "firm-a",
      conversation_id: "conv-1",
      lead_id: "lead-1",
      status: "requested",
      service_id: null,
      routing_group: null,
      visitor_name: "Amara",
      visitor_email: "lead@example.com",
      visitor_phone: null,
      company_name: null,
      preferred_booking_at: "2026-01-01T10:30:00.000Z",
      preferred_time_text: null,
      matter_summary: "SAFE review",
      lead_brief: "Brief",
      urgency: null,
      source_url: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };

    const updated = {
      ...existing,
      visitor_phone: "+2348000000000",
      preferred_time_text: "Weekday mornings",
      updated_at: "2026-01-02T00:00:00.000Z",
    };

    const sql = vi
      .fn()
      .mockResolvedValueOnce([existing])
      .mockResolvedValueOnce([updated]);
    setSqlForTests(sql as never);

    const booking = await createBookingRequest({
      firmId: "firm-a",
      conversationId: "conv-1",
      leadId: "lead-1",
      visitorName: "Amara",
      visitorEmail: "lead@example.com",
      visitorPhone: "+2348000000000",
      preferredTimeText: "Weekday mornings",
      matterSummary: "SAFE review",
      leadBrief: "Brief",
    });

    expect(booking.visitorPhone).toBe("+2348000000000");
    expect(booking.preferredBookingAt).toBe("2026-01-01T10:30:00.000Z");
    expect(booking.preferredTimeText).toBe("Weekday mornings");
    expect(sql).toHaveBeenCalledTimes(2);
  });

  it("does not insert a duplicate lead score event for the same idempotency key", async () => {
    const leadRow = {
      id: "lead-1",
      firm_id: "firm-a",
      conversation_id: "conv-1",
      visitor_id: null,
      status: "new",
      temperature: "warm",
      score: 70,
      primary_service_id: null,
      name: "Amara",
      email: "lead@example.com",
      phone: null,
      company_name: null,
      summary: "SAFE review",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };

    const sql = vi.fn().mockResolvedValueOnce([leadRow]);
    setSqlForTests(sql as never);

    const lead = await upsertLeadProfile({
      firmId: "firm-a",
      conversationId: "conv-1",
      summary: "SAFE review",
      score: 70,
      temperature: "warm",
      scoreFactors: {
        serviceFit: 0.8,
        urgency: 0.5,
        specificity: 0.7,
        commercialValue: 0.6,
        readiness: 0.7,
        contactConfidence: 0.8,
      },
      reason: "qualified",
      idempotencyKey: "firm-a:conv-1:turn-1:upsert_lead",
    });

    expect(lead.id).toBe("lead-1");
    expect(sql).toHaveBeenCalledTimes(1);
    expect(String(sql.mock.calls[0]?.[0])).toContain("ON CONFLICT (idempotency_key) DO NOTHING");
  });

  it("rolls back lead profile writes when score event insertion fails", async () => {
    const sql = vi.fn().mockRejectedValueOnce(new Error("score insert failed"));
    setSqlForTests(sql as never);

    await expect(
      upsertLeadProfile({
        firmId: "firm-a",
        conversationId: "conv-1",
        summary: "SAFE review",
        score: 70,
        temperature: "warm",
        scoreFactors: {
          serviceFit: 0.8,
          urgency: 0.5,
          specificity: 0.7,
          commercialValue: 0.6,
          readiness: 0.7,
          contactConfidence: 0.8,
        },
        reason: "qualified",
      }),
    ).rejects.toThrow("score insert failed");

    expect(sql).toHaveBeenCalledTimes(1);
  });
});
