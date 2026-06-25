import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUpsertLeadTool } from "../../src/tools/upsert_lead.ts";
import { createBookingRequestTool } from "../../src/tools/create_booking_request.ts";

const requireSessionBinding = vi.fn();
const resolveConversationWriteIds = vi.fn();
const resolveScopedServiceId = vi.fn();
const getFirmBookingPolicy = vi.fn();
const findOpenBookingRequest = vi.fn();
const upsertLeadProfile = vi.fn();
const createBookingRequest = vi.fn();
const deriveWriteIdempotencyKey = vi.fn();
const logLeadPilotEvent = vi.fn();

vi.mock("@leadpilot/db", () => ({
  createBookingRequest: (...args: unknown[]) => createBookingRequest(...args),
  findOpenBookingRequest: (...args: unknown[]) => findOpenBookingRequest(...args),
  getFirmBookingPolicy: (...args: unknown[]) => getFirmBookingPolicy(...args),
  upsertLeadProfile: (...args: unknown[]) => upsertLeadProfile(...args),
}));

vi.mock("../../src/agent/lib/session-scope.ts", () => ({
  requireSessionBinding: (...args: unknown[]) => requireSessionBinding(...args),
}));

vi.mock("../../src/agent/lib/resource-scope.ts", () => ({
  resolveConversationWriteIds: (...args: unknown[]) => resolveConversationWriteIds(...args),
  resolveScopedServiceId: (...args: unknown[]) => resolveScopedServiceId(...args),
}));

vi.mock("../../src/agent/lib/write-idempotency.ts", () => ({
  deriveWriteIdempotencyKey: (...args: unknown[]) => deriveWriteIdempotencyKey(...args),
}));

vi.mock("../../src/agent/lib/observability.ts", () => ({
  logLeadPilotEvent: (...args: unknown[]) => logLeadPilotEvent(...args),
}));

describe("persistence failure fallbacks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deriveWriteIdempotencyKey.mockReturnValue("idem-key");
  });

  it("returns a structured failure from upsert_lead when the session binding cannot be resolved", async () => {
    requireSessionBinding.mockRejectedValue(new Error("DATABASE_URL is required"));

    const tool = createUpsertLeadTool("avance", "browser-1");
    const result = await tool.run({
      input: {
        summary: "Need help with a fintech privacy question.",
        reason: "High intent",
        scoreFactors: {
          serviceFit: 0.8,
          urgency: 0.7,
          specificity: 0.7,
          commercialValue: 0.6,
          readiness: 0.8,
          contactConfidence: 0.9,
        },
      },
    });

    expect(result).toMatchObject({
      persisted: false,
      status: "failed",
      failureReason: "persistence_unavailable",
      errorMessage: "Lead persistence is unavailable right now.",
      nextAction: "continue_qualification",
    });
    expect(resolveConversationWriteIds).not.toHaveBeenCalled();
    expect(getFirmBookingPolicy).not.toHaveBeenCalled();
    expect(upsertLeadProfile).not.toHaveBeenCalled();
    expect(logLeadPilotEvent).toHaveBeenCalledTimes(1);
  });

  it("returns a structured failure from create_booking_request when the session binding cannot be resolved", async () => {
    requireSessionBinding.mockRejectedValue(new Error("DATABASE_URL is required"));

    const tool = createBookingRequestTool("avance", "browser-1");
    const result = await tool.run({
      input: {
        matterSummary: "Need help with a fintech privacy question.",
        leadBrief: "High intent.",
      },
    });

    expect(result).toMatchObject({
      ok: false,
      status: "failed",
      failureReason: "persistence_unavailable",
      errorMessage: "Booking request persistence is unavailable right now.",
    });
    expect(resolveConversationWriteIds).not.toHaveBeenCalled();
    expect(getFirmBookingPolicy).not.toHaveBeenCalled();
    expect(findOpenBookingRequest).not.toHaveBeenCalled();
    expect(createBookingRequest).not.toHaveBeenCalled();
    expect(logLeadPilotEvent).toHaveBeenCalledTimes(1);
  });
});
