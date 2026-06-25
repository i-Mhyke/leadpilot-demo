import { describe, expect, it, vi, beforeEach } from "vitest";
import { setSqlForTests } from "./client.ts";
import { createFirm, deleteFirmBySlug, getFirmBookingPolicy, getFirmPricingPolicy } from "./firms.ts";

describe("firm policies", () => {
  beforeEach(() => {
    setSqlForTests(null);
  });

  it("falls back to no fee discussion when pricing policy is missing", async () => {
    const sql = vi.fn(async () => []);
    setSqlForTests(sql as never);

    const policy = await getFirmPricingPolicy("firm-1");
    expect(policy.canDiscussFees).toBe(false);
    expect(policy.requiresHumanForFeeQuestions).toBe(true);
  });

  it("falls back to request_only booking defaults", async () => {
    const sql = vi.fn(async () => []);
    setSqlForTests(sql as never);

    const policy = await getFirmBookingPolicy("firm-1");
    expect(policy.bookingMode).toBe("request_only");
    expect(policy.contactCaptureThreshold).toBe(55);
  });
});

describe("firm provisioning", () => {
  beforeEach(() => {
    setSqlForTests(null);
  });

  it("returns the existing active firm when the same business is provisioned again", async () => {
    const sql = vi.fn(async (_strings: TemplateStringsArray, ..._values: unknown[]): Promise<unknown[]> => [
      {
        id: "firm-1",
        name: "Harbor & Vale Legal",
        slug: "harbor-vale-legal",
        industry: "legal",
        jurisdiction: "Nigeria",
        website_url: null,
        status: "active",
      },
    ]);
    setSqlForTests(sql as never);

    const firm = await createFirm({
      name: " Harbor & Vale Legal ",
      industry: "legal",
      jurisdiction: "Nigeria",
    });

    expect(firm).toEqual({
      id: "firm-1",
      name: "Harbor & Vale Legal",
      slug: "harbor-vale-legal",
      industry: "legal",
      jurisdiction: "Nigeria",
      status: "active",
    });
    expect(sql).toHaveBeenCalledTimes(1);
    expect(String(sql.mock.calls[0]?.[0])).toContain("lower(name) = lower");
    expect(String(sql.mock.calls[0]?.[0])).toContain("lower(coalesce(jurisdiction, '')) = lower");
    expect(String(sql.mock.calls[0]?.[0])).toContain("status = 'active'");
  });

  it("generates a unique slug when the base slug is already taken", async () => {
    const sql = vi
      .fn(async (_strings: TemplateStringsArray, ..._values: unknown[]): Promise<unknown[]> => [])
      .mockResolvedValueOnce([] as unknown[])
      .mockResolvedValueOnce([{ slug: "acme-law" }, { slug: "acme-law-2" }] as unknown[])
      .mockResolvedValueOnce([
        {
          id: "firm-2",
          name: "Acme Law",
          slug: "acme-law-3",
          industry: "legal",
          jurisdiction: "Nigeria",
          website_url: null,
          status: "active",
        },
      ]);
    setSqlForTests(sql as never);

    const firm = await createFirm({
      name: "Acme Law",
      industry: "legal",
      jurisdiction: "Nigeria",
    });

    expect(firm.slug).toBe("acme-law-3");
    expect(String(sql.mock.calls[1]?.[0])).toMatch(/SELECT\s+slug\s+FROM\s+firms/);
    expect(String(sql.mock.calls[2]?.[0])).toContain("INSERT INTO firms");
    expect(String(sql.mock.calls[2]?.[0])).toContain("jurisdiction");
    expect(String(sql.mock.calls[2]?.[0])).toContain("ON CONFLICT (slug) DO NOTHING");
  });

  it("re-reads the existing firm after a conflicting insert retry", async () => {
    const sql = vi
      .fn(async (_strings: TemplateStringsArray, ..._values: unknown[]): Promise<unknown[]> => [])
      .mockResolvedValueOnce([] as unknown[])
      .mockResolvedValueOnce([] as unknown[])
      .mockResolvedValueOnce([] as unknown[])
      .mockResolvedValueOnce([
        {
          id: "firm-1",
          name: "Harbor & Vale Legal",
          slug: "harbor-vale-legal",
          industry: "legal",
          jurisdiction: "Nigeria",
          website_url: null,
          status: "active",
        },
      ]);
    setSqlForTests(sql as never);

    const firm = await createFirm({
      name: "Harbor & Vale Legal",
      industry: "legal",
      jurisdiction: "Nigeria",
    });

    expect(firm.slug).toBe("harbor-vale-legal");
    expect(sql).toHaveBeenCalledTimes(4);
    expect(String(sql.mock.calls[0]?.[0])).toContain("lower(name) = lower");
    expect(String(sql.mock.calls[0]?.[0])).toContain("lower(coalesce(jurisdiction, '')) = lower");
    expect(String(sql.mock.calls[3]?.[0])).toContain("lower(name) = lower");
  });
});

describe("firm deletion", () => {
  beforeEach(() => {
    setSqlForTests(null);
  });

  function mockFirmRow(overrides: Partial<{
    id: string;
    name: string;
    slug: string;
    industry: string;
    jurisdiction: string;
    status: string;
  }> = {}) {
    return {
      id: "firm-1",
      name: "Harbor & Vale Legal",
      slug: "harbor-vale-legal",
      industry: "legal",
      jurisdiction: "Nigeria",
      website_url: null,
      status: "active",
      ...overrides,
    };
  }

  it("deletes explicit non-cascade tables and the firm row", async () => {
    const sql = vi
      .fn(async (_strings: TemplateStringsArray, ..._values: unknown[]): Promise<unknown[]> => [])
      .mockResolvedValueOnce([mockFirmRow()])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    setSqlForTests(sql as never);

    const firm = await deleteFirmBySlug("harbor-vale-legal");

    expect(firm).toMatchObject({ slug: "harbor-vale-legal" });
    expect(sql).toHaveBeenCalledTimes(5);
    expect(String(sql.mock.calls[1]?.[0])).toContain("DELETE FROM retrieval_logs");
    expect(String(sql.mock.calls[2]?.[0])).toContain("DELETE FROM legal_unit_chunks");
    expect(String(sql.mock.calls[3]?.[0])).toContain("DELETE FROM request_rate_limits");
    expect(String(sql.mock.calls[4]?.[0])).toContain("DELETE FROM firms");
  });

  it("returns not_found without running delete statements", async () => {
    const sql = vi.fn(async () => []);
    setSqlForTests(sql as never);

    const result = await deleteFirmBySlug("missing-firm");

    expect(result).toEqual({ kind: "not_found", slug: "missing-firm" });
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it("deletes inactive firms for admin purge", async () => {
    const sql = vi
      .fn(async (_strings: TemplateStringsArray, ..._values: unknown[]): Promise<unknown[]> => [])
      .mockResolvedValueOnce([mockFirmRow({ status: "inactive", slug: "old-firm" })])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    setSqlForTests(sql as never);

    const firm = await deleteFirmBySlug("old-firm");

    expect(firm).toMatchObject({ slug: "old-firm", status: "inactive" });
    expect(sql).toHaveBeenCalledTimes(5);
  });

  it("is idempotent when the firm row is already gone", async () => {
    const sql = vi
      .fn(async (_strings: TemplateStringsArray, ..._values: unknown[]): Promise<unknown[]> => [])
      .mockResolvedValueOnce([mockFirmRow()])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    setSqlForTests(sql as never);

    await deleteFirmBySlug("harbor-vale-legal");
    const second = await deleteFirmBySlug("harbor-vale-legal");

    expect(second).toEqual({ kind: "not_found", slug: "harbor-vale-legal" });
  });
});
