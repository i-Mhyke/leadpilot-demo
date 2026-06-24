import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setSqlForTests } from "./client.ts";
import {
  assertFirmConversation,
  assertFirmLeadForConversation,
  assertFirmService,
  assertFirmVisitor,
  FirmOwnershipError,
  getConversationWriteScope,
  resolveFirmServiceId,
} from "./firm-ownership.ts";
import { createBookingRequest, upsertLeadProfile } from "./leads.ts";

describe("firm ownership guards", () => {
  beforeEach(() => {
    setSqlForTests(null);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    setSqlForTests(null);
  });

  it("rejects cross-firm serviceId on lead upsert", async () => {
    const sql = vi.fn().mockResolvedValue([]);
    setSqlForTests(sql as never);

    await expect(
      upsertLeadProfile({
        firmId: "firm-a",
        conversationId: "conv-a",
        primaryServiceId: "svc-other",
        score: 50,
        temperature: "warm",
        scoreFactors: {
          serviceFit: 0.5,
          urgency: 0.5,
          specificity: 0.5,
          commercialValue: 0.5,
          readiness: 0.5,
          contactConfidence: 0.5,
        },
        reason: "test",
      }),
    ).rejects.toBeInstanceOf(FirmOwnershipError);
  });

  it("rejects cross-firm visitorId on booking create", async () => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    setSqlForTests(sql as never);

    await expect(
      createBookingRequest({
        firmId: "firm-a",
        conversationId: "conv-a",
        visitorId: "visitor-b",
        matterSummary: "SAFE review",
        leadBrief: "Brief",
      }),
    ).rejects.toBeInstanceOf(FirmOwnershipError);
  });

  it("rejects leadId from another conversation", async () => {
    const sql = vi.fn().mockResolvedValue([]);
    setSqlForTests(sql as never);

    await expect(
      assertFirmLeadForConversation("firm-a", "conv-a", "lead-b"),
    ).rejects.toBeInstanceOf(FirmOwnershipError);
  });

  it("rejects serviceId from another firm", async () => {
    const sql = vi.fn().mockResolvedValue([]);
    setSqlForTests(sql as never);

    await expect(assertFirmService("firm-a", "svc-b")).rejects.toBeInstanceOf(FirmOwnershipError);
  });

  it("resolves a firm service slug to its canonical id", async () => {
    const sql = vi.fn().mockResolvedValue([{ id: "svc-uuid" }]);
    setSqlForTests(sql as never);

    await expect(resolveFirmServiceId("firm-a", "startup-law")).resolves.toBe("svc-uuid");
    expect(String(sql.mock.calls[0]?.[0])).toContain("slug =");
  });

  it("rejects unknown service slugs", async () => {
    const sql = vi.fn().mockResolvedValue([]);
    setSqlForTests(sql as never);

    await expect(resolveFirmServiceId("firm-a", "missing-service")).rejects.toBeInstanceOf(
      FirmOwnershipError,
    );
  });

  it("rejects visitorId from another firm", async () => {
    const sql = vi.fn().mockResolvedValue([]);
    setSqlForTests(sql as never);

    await expect(assertFirmVisitor("firm-a", "visitor-b")).rejects.toBeInstanceOf(FirmOwnershipError);
  });

  it("rejects conversationId from another firm", async () => {
    const sql = vi.fn().mockResolvedValue([]);
    setSqlForTests(sql as never);

    await expect(assertFirmConversation("firm-a", "conv-b")).rejects.toBeInstanceOf(FirmOwnershipError);
  });

  it("resolves visitor and lead ids from the active conversation", async () => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([{ visitor_id: "visitor-a" }])
      .mockResolvedValueOnce([{ id: "lead-a" }]);
    setSqlForTests(sql as never);

    await expect(getConversationWriteScope("firm-a", "conv-a")).resolves.toEqual({
      visitorId: "visitor-a",
      leadId: "lead-a",
    });
  });
});
