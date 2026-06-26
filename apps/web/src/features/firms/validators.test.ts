import { describe, expect, it } from "vitest";
import { FIRM_JURISDICTION_OPTIONS } from "@leadpilot/shared";
import {
  FirmProvisioningRequestError,
  FIRM_INDUSTRY_OPTIONS,
  MarkdownUploadRequestError,
  parseFirmBrainUploadRequest,
  parseFirmKnowledgeUploadRequest,
  parseFirmProvisioningRequest,
  parseFirmProvisioningSearchRequest,
} from "./validators";

describe("firm provisioning validators", () => {
  it("trims the business name and accepts a known industry", () => {
    expect(
      parseFirmProvisioningRequest({
        name: "  Northline Advisory  ",
        industry: "consulting",
        jurisdiction: "NG",
      }),
    ).toEqual({
      name: "Northline Advisory",
      industry: "consulting",
      jurisdiction: "Nigeria",
    });
  });

  it("accepts canonical jurisdiction names", () => {
    expect(
      parseFirmProvisioningRequest({
        name: "Northline Advisory",
        industry: "consulting",
        jurisdiction: "United Kingdom",
      }),
    ).toEqual({
      name: "Northline Advisory",
      industry: "consulting",
      jurisdiction: "United Kingdom",
    });
  });

  it("rejects blank names", () => {
    expect(() =>
      parseFirmProvisioningRequest({
        name: "   ",
        industry: "legal",
        jurisdiction: "NG",
      }),
    ).toThrowError(FirmProvisioningRequestError);
  });

  it("rejects unknown industries", () => {
    expect(() =>
      parseFirmProvisioningRequest({
        name: "Northline Advisory",
        industry: "media",
        jurisdiction: "NG",
      }),
    ).toThrowError(/industry/i);
  });

  it("rejects unknown jurisdictions", () => {
    expect(() =>
      parseFirmProvisioningRequest({
        name: "Northline Advisory",
        industry: "consulting",
        jurisdiction: "Atlantis",
      }),
    ).toThrowError(/country/i);
  });

  it("rejects unexpected fields", () => {
    expect(() =>
      parseFirmProvisioningRequest({
        name: "Northline Advisory",
        industry: "consulting",
        jurisdiction: "NG",
        slug: "northline-advisory",
      }),
    ).toThrowError(/Unexpected field/i);
  });

  it("accepts firm directory search filters", () => {
    expect(
      parseFirmProvisioningSearchRequest({
        country: "NG",
        sector: "consulting",
        mode: "add",
      }),
    ).toEqual({
      country: "Nigeria",
      sector: "consulting",
      mode: "add",
    });
  });

  it("exposes the supported industries for the form", () => {
    expect(FIRM_INDUSTRY_OPTIONS).toContain("legal");
    expect(FIRM_INDUSTRY_OPTIONS).toContain("general");
  });

  it("exposes the full jurisdiction list for the form", () => {
    expect(FIRM_JURISDICTION_OPTIONS.length).toBeGreaterThan(200);
    expect(FIRM_JURISDICTION_OPTIONS.some((entry) => entry.code === "NG")).toBe(true);
    expect(FIRM_JURISDICTION_OPTIONS.some((entry) => entry.name === "Nigeria")).toBe(true);
  });

  it("accepts markdown uploads with .md filenames", () => {
    expect(
      parseFirmKnowledgeUploadRequest({
        firmSlug: "northline-advisory",
        filename: "company-knowledge.md",
        contentMarkdown: "# Knowledge",
      }),
    ).toEqual({
      firmSlug: "northline-advisory",
      filename: "company-knowledge.md",
      contentMarkdown: "# Knowledge",
    });
    expect(
      parseFirmBrainUploadRequest({
        firmSlug: "northline-advisory",
        filename: "firm-brain.md",
        contentMarkdown: "# Brain",
      }),
    ).toEqual({
      firmSlug: "northline-advisory",
      filename: "firm-brain.md",
      contentMarkdown: "# Brain",
    });
  });

  it("rejects non-markdown uploads", () => {
    expect(() =>
      parseFirmKnowledgeUploadRequest({
        firmSlug: "northline-advisory",
        filename: "company-knowledge.txt",
        contentMarkdown: "# Knowledge",
      }),
    ).toThrowError(MarkdownUploadRequestError);
  });
});
