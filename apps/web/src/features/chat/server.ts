import { createServerFn } from "@tanstack/react-start";
import type { FirmAgentProfile, FirmBrainConfig } from "@leadpilot/shared";
import { getFirmBrainConfigByFirmId, getFirmProfileBySlug, recordFirmPageVisit } from "@leadpilot/db";
import { parseFirmSlugRequest } from "../firms/validators";

export const loadAskFirmPageState = createServerFn({ method: "GET" })
  .validator((data: unknown) => parseFirmSlugRequest(data))
  .handler(async ({ data }): Promise<{ firmProfile: FirmAgentProfile | null; brainConfig: FirmBrainConfig | null }> => {
    const profile = await getFirmProfileBySlug(data.firmSlug);
    if ("kind" in profile) {
      return { firmProfile: null, brainConfig: null };
    }
    void recordFirmPageVisit({ firmId: profile.firm.id, pageKey: "ask" }).catch(() => undefined);
    const brainConfig = await getFirmBrainConfigByFirmId(profile.firm.id);

    return { firmProfile: profile, brainConfig };
  });
