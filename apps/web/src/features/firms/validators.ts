import {
  FIRM_JURISDICTION_OPTIONS,
  resolveFirmJurisdiction,
} from "@leadpilot/shared";

export const FIRM_INDUSTRY_OPTIONS = [
  "legal",
  "healthcare",
  "accounting",
  "consulting",
  "real_estate",
  "general",
] as const;

export type FirmIndustryOption = (typeof FIRM_INDUSTRY_OPTIONS)[number];

export { FIRM_JURISDICTION_OPTIONS };

const ALLOWED_FIELDS = new Set(["name", "industry", "jurisdiction"]);
const ALLOWED_UPLOAD_FIELDS = new Set(["firmSlug", "filename", "contentMarkdown"]);
const ALLOWED_TENANT_SEARCH_FIELDS = new Set(["firmSlug", "mode"]);

export class FirmProvisioningRequestError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "FirmProvisioningRequestError";
  }
}

export class MarkdownUploadRequestError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "MarkdownUploadRequestError";
  }
}

export function parseFirmSlugRequest(data: unknown): { firmSlug: string } {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new FirmProvisioningRequestError("invalid_payload", "Request payload must be an object.");
  }

  const record = data as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key !== "firmSlug") {
      throw new FirmProvisioningRequestError(
        "unexpected_field",
        `Unexpected field "${key}" is not allowed.`,
      );
    }
  }

  if (typeof record.firmSlug !== "string" || !record.firmSlug.trim()) {
    throw new FirmProvisioningRequestError("invalid_firm_slug", "firmSlug is required.");
  }

  return { firmSlug: record.firmSlug.trim() };
}

export function parseFirmProvisioningSearchRequest(data: unknown): {
  firmSlug?: string;
  mode?: "add";
} {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new FirmProvisioningRequestError("invalid_payload", "Search params must be an object.");
  }

  const record = data as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!ALLOWED_TENANT_SEARCH_FIELDS.has(key)) {
      throw new FirmProvisioningRequestError(
        "unexpected_field",
        `Unexpected field "${key}" is not allowed.`,
      );
    }
  }

  const search: { firmSlug?: string; mode?: "add" } = {};

  if (record.firmSlug !== undefined) {
    if (typeof record.firmSlug !== "string" || !record.firmSlug.trim()) {
      throw new FirmProvisioningRequestError("invalid_firm_slug", "firmSlug is required.");
    }
    search.firmSlug = record.firmSlug.trim();
  }

  if (record.mode !== undefined) {
    if (record.mode !== "add") {
      throw new FirmProvisioningRequestError("invalid_mode", "mode must be add.");
    }
    search.mode = "add";
  }

  return search;
}

function normalizeFirmName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function isFirmIndustryOption(value: string): value is FirmIndustryOption {
  return (FIRM_INDUSTRY_OPTIONS as readonly string[]).includes(value);
}

export function parseFirmProvisioningRequest(data: unknown): {
  name: string;
  industry: FirmIndustryOption;
  jurisdiction: string;
} {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new FirmProvisioningRequestError("invalid_payload", "Request payload must be an object.");
  }

  const record = data as Record<string, unknown>;

  for (const key of Object.keys(record)) {
    if (!ALLOWED_FIELDS.has(key)) {
      throw new FirmProvisioningRequestError(
        "unexpected_field",
        `Unexpected field "${key}" is not allowed.`,
      );
    }
  }

  if (typeof record.name !== "string") {
    throw new FirmProvisioningRequestError("invalid_name", "Business name is required.");
  }

  const name = normalizeFirmName(record.name);
  if (!name) {
    throw new FirmProvisioningRequestError("invalid_name", "Business name is required.");
  }

  if (!/[a-z0-9]/i.test(name)) {
    throw new FirmProvisioningRequestError(
      "invalid_name",
      "Business name must contain at least one letter or number.",
    );
  }

  if (typeof record.industry !== "string" || !isFirmIndustryOption(record.industry)) {
    throw new FirmProvisioningRequestError(
      "invalid_industry",
      "Choose a supported industry before creating the tenant.",
    );
  }

  if (typeof record.jurisdiction !== "string") {
    throw new FirmProvisioningRequestError(
      "invalid_jurisdiction",
      "Choose a supported country before creating the tenant.",
    );
  }

  const jurisdiction = resolveFirmJurisdiction(record.jurisdiction);
  if (!jurisdiction) {
    throw new FirmProvisioningRequestError(
      "invalid_jurisdiction",
      "Choose a supported country before creating the tenant.",
    );
  }

  return {
    name,
    industry: record.industry,
    jurisdiction,
  };
}

function normalizeUploadFilename(filename: string): string {
  return filename.trim().replace(/\s+/g, " ");
}

function parseMarkdownUploadRequest(data: unknown, scopeLabel: string): {
  firmSlug: string;
  filename: string;
  contentMarkdown: string;
} {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new MarkdownUploadRequestError("invalid_payload", "Request payload must be an object.");
  }

  const record = data as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!ALLOWED_UPLOAD_FIELDS.has(key)) {
      throw new MarkdownUploadRequestError(
        "unexpected_field",
        `Unexpected field "${key}" is not allowed.`,
      );
    }
  }

  if (typeof record.firmSlug !== "string" || !record.firmSlug.trim()) {
    throw new MarkdownUploadRequestError("invalid_firm_slug", "A firm slug is required.");
  }

  if (typeof record.filename !== "string") {
    throw new MarkdownUploadRequestError("invalid_filename", `${scopeLabel} upload needs a filename.`);
  }

  const filename = normalizeUploadFilename(record.filename);
  if (!/\.md$/i.test(filename)) {
    throw new MarkdownUploadRequestError(
      "invalid_filename",
      `${scopeLabel} upload must use a .md file.`,
    );
  }

  if (typeof record.contentMarkdown !== "string" || !record.contentMarkdown.trim()) {
    throw new MarkdownUploadRequestError(
      "invalid_content",
      `${scopeLabel} upload file cannot be empty.`,
    );
  }

  return {
    firmSlug: record.firmSlug.trim(),
    filename,
    contentMarkdown: record.contentMarkdown,
  };
}

export function parseFirmKnowledgeUploadRequest(data: unknown): {
  firmSlug: string;
  filename: string;
  contentMarkdown: string;
} {
  return parseMarkdownUploadRequest(data, "Knowledge base");
}

export function parseFirmBrainUploadRequest(data: unknown): {
  firmSlug: string;
  filename: string;
  contentMarkdown: string;
} {
  return parseMarkdownUploadRequest(data, "Brain");
}
