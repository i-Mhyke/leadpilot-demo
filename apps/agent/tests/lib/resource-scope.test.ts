import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FirmOwnershipError } from "@leadpilot/db";
import { setSessionBindingForTests, resetPersistenceStateForTests } from "../../src/agent/lib/persistence.ts";
import { resolveScopedServiceId } from "../../src/agent/lib/resource-scope.ts";
import { requireStaffFirmId, StaffScopeError } from "../../src/agent/lib/staff-scope.ts";

vi.mock("@leadpilot/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@leadpilot/db")>();
  return {
    ...actual,
    resolveFirmServiceId: vi.fn(actual.resolveFirmServiceId),
    getFirmBySlug: vi.fn(),
  };
});

import { FirmOwnershipError, getFirmBySlug, resolveFirmServiceId } from "@leadpilot/db";

const binding = {
  firmId: "firm-a",
  firmSlug: "demo-law",
  conversationId: "conv-a",
};

describe("resource scope", () => {
  beforeEach(() => {
    resetPersistenceStateForTests();
    setSessionBindingForTests("eve-1", binding);
    vi.mocked(resolveFirmServiceId).mockReset();
  });

  it("rejects serviceId that does not belong to the active firm", async () => {
    vi.mocked(resolveFirmServiceId).mockRejectedValue(
      new FirmOwnershipError("serviceId does not belong to the active firm."),
    );

    await expect(resolveScopedServiceId(binding, "svc-other")).rejects.toBeInstanceOf(FirmOwnershipError);
  });

  it("resolves service slugs through the firm service resolver", async () => {
    vi.mocked(resolveFirmServiceId).mockResolvedValue("svc-uuid");

    await expect(resolveScopedServiceId(binding, "startup-law")).resolves.toBe("svc-uuid");
    expect(resolveFirmServiceId).toHaveBeenCalledWith("firm-a", "startup-law");
  });
});

describe("staff scope", () => {
  const originalStaffAnalytics = process.env.LEADPILOT_STAFF_ANALYTICS;
  const originalStaffFirmId = process.env.LEADPILOT_STAFF_FIRM_ID;

  beforeEach(() => {
    vi.mocked(getFirmBySlug).mockReset();
  });

  afterEach(() => {
    if (originalStaffAnalytics === undefined) delete process.env.LEADPILOT_STAFF_ANALYTICS;
    else process.env.LEADPILOT_STAFF_ANALYTICS = originalStaffAnalytics;
    if (originalStaffFirmId === undefined) delete process.env.LEADPILOT_STAFF_FIRM_ID;
    else process.env.LEADPILOT_STAFF_FIRM_ID = originalStaffFirmId;
  });

  it("requires staff auth or staff analytics env before analytics reads", async () => {
    delete process.env.LEADPILOT_STAFF_ANALYTICS;
    delete process.env.LEADPILOT_STAFF_FIRM_ID;

    await expect(
      requireStaffFirmId({ session: { auth: { current: null } } } as ToolContext),
    ).rejects.toBeInstanceOf(StaffScopeError);
  });

  it("resolves staff firm slug from env to firm id", async () => {
    process.env.LEADPILOT_STAFF_ANALYTICS = "true";
    process.env.LEADPILOT_STAFF_FIRM_ID = "demo-law";
    vi.mocked(getFirmBySlug).mockResolvedValue({
      id: "firm-uuid",
      name: "E&C Legal",
      slug: "demo-law",
      industry: "legal",
      jurisdiction: "Nigeria",
      websiteUrl: undefined,
      status: "active",
    });

    await expect(
      requireStaffFirmId({ session: { auth: { current: null } } } as ToolContext),
    ).resolves.toBe("firm-uuid");
  });

  it("accepts staff firm uuid without slug lookup", async () => {
    process.env.LEADPILOT_STAFF_ANALYTICS = "true";
    process.env.LEADPILOT_STAFF_FIRM_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

    await expect(
      requireStaffFirmId({ session: { auth: { current: null } } } as ToolContext),
    ).resolves.toBe("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");

    expect(getFirmBySlug).not.toHaveBeenCalled();
  });
});
