import { describe, expect, it, vi, beforeEach } from "vitest";
import { setSqlForTests } from "./client.ts";
import { createFirm, getFirmBookingPolicy, getFirmPricingPolicy } from "./firms.ts";

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
