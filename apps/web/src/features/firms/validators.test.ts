import { describe, expect, it } from "vitest";
import {
  FirmProvisioningRequestError,
  FIRM_INDUSTRY_OPTIONS,
  MarkdownUploadRequestError,
  parseFirmBrainUploadRequest,
  parseFirmKnowledgeUploadRequest,
  parseFirmProvisioningRequest,
} from "./validators";

describe("firm provisioning validators", () => {
  it("trims the business name and accepts a known industry", () => {
    expect(
      parseFirmProvisioningRequest({
        name: "  Northline Advisory  ",
        industry: "consulting",
      }),
    ).toEqual({
      name: "Northline Advisory",
      industry: "consulting",
    });
  });

  it("rejects blank names", () => {
    expect(() =>
      parseFirmProvisioningRequest({
        name: "   ",
        industry: "legal",
      }),
    ).toThrowError(FirmProvisioningRequestError);
  });

  it("rejects unknown industries", () => {
    expect(() =>
      parseFirmProvisioningRequest({
        name: "Northline Advisory",
        industry: "media",
      }),
    ).toThrowError(/industry/i);
  });

  it("rejects unexpected fields", () => {
    expect(() =>
      parseFirmProvisioningRequest({
        name: "Northline Advisory",
        industry: "consulting",
        slug: "northline-advisory",
      }),
    ).toThrowError(/Unexpected field/i);
  });

  it("exposes the supported industries for the form", () => {
    expect(FIRM_INDUSTRY_OPTIONS).toContain("legal");
    expect(FIRM_INDUSTRY_OPTIONS).toContain("general");
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
