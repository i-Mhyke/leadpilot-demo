import { createServerFn } from "@tanstack/react-start";
import {
  createFirm,
  getFirmBrainConfigByFirmId,
  getFirmBySlug,
  listActiveFirms,
  saveFirmBrainConfig,
} from "@leadpilot/db";
import { ingestUploadedFirmKnowledgeMarkdown, type FirmKnowledgeUploadResult } from "@leadpilot/firm-rag";
import type { Firm, FirmBrainConfig } from "@leadpilot/shared";
import {
  parseFirmBrainUploadRequest,
  parseFirmKnowledgeUploadRequest,
  parseFirmProvisioningRequest,
  parseFirmProvisioningSearchRequest,
  parseFirmSlugRequest,
} from "./validators";

export type FirmProvisioningPageState = {
  firms: Firm[];
  selectedFirm: Firm | null;
  brainConfig: FirmBrainConfig | null;
  selectionError: string | null;
};

export const createFirmProvisioning = createServerFn({ method: "POST" })
  .validator((data: unknown) => parseFirmProvisioningRequest(data))
  .handler(async ({ data }): Promise<Firm> => {
    return createFirm({
      name: data.name,
      industry: data.industry,
      jurisdiction: data.country,
    });
  });

export const loadFirmProvisioningState = createServerFn({ method: "GET" })
  .validator((data: unknown) => parseFirmSlugRequest(data))
  .handler(async ({ data }): Promise<{ firm: Firm; brainConfig: FirmBrainConfig | null }> => {
    const firm = await getFirmBySlug(data.firmSlug);
    if ("kind" in firm) {
      throw new Error(firm.kind === "inactive" ? "Firm inactive." : "Unknown firm.");
    }
    const brainConfig = await getFirmBrainConfigByFirmId(firm.id);
    return { firm, brainConfig };
  });

export const loadFirmProvisioningPageState = createServerFn({ method: "GET" })
  .validator((data: unknown) => parseFirmProvisioningSearchRequest(data))
  .handler(async ({ data }): Promise<FirmProvisioningPageState> => {
    const firms = await listActiveFirms();
    if (data.mode === "add" || !data.firmSlug) {
      return {
        firms,
        selectedFirm: null,
        brainConfig: null,
        selectionError: null,
      };
    }

    const firm = await getFirmBySlug(data.firmSlug);
    if ("kind" in firm) {
      return {
        firms,
        selectedFirm: null,
        brainConfig: null,
        selectionError:
          firm.kind === "inactive"
            ? "That firm is inactive."
            : "Select a firm from the list or create a new one.",
      };
    }

    const brainConfig = await getFirmBrainConfigByFirmId(firm.id);
    return {
      firms,
      selectedFirm: firm,
      brainConfig,
      selectionError: null,
    };
  });

export const saveFirmBrainProvisioning = createServerFn({ method: "POST" })
  .validator((data: unknown) => parseFirmBrainUploadRequest(data))
  .handler(async ({ data }): Promise<FirmBrainConfig> => {
    const firm = await getFirmBySlug(data.firmSlug);
    if ("kind" in firm) {
      throw new Error(firm.kind === "inactive" ? "Firm inactive." : "Unknown firm.");
    }
    return saveFirmBrainConfig({
      firmId: firm.id,
      sourceFilename: data.filename,
      contentMarkdown: data.contentMarkdown,
    });
  });

export const uploadFirmKnowledgeProvisioning = createServerFn({ method: "POST" })
  .validator((data: unknown) => parseFirmKnowledgeUploadRequest(data))
  .handler(async ({ data }): Promise<FirmKnowledgeUploadResult> => {
    const firm = await getFirmBySlug(data.firmSlug);
    if ("kind" in firm) {
      throw new Error(firm.kind === "inactive" ? "Firm inactive." : "Unknown firm.");
    }
    const result = await ingestUploadedFirmKnowledgeMarkdown({
      firmId: firm.id,
      firmSlug: firm.slug,
      firmDisplayName: firm.name,
      contentMarkdown: data.contentMarkdown,
    });
    return result;
  });
