import { createServerFn } from "@tanstack/react-start";
import {
  listFirmContentRecommendationsBySlug,
  runOnDemandContentInsight,
} from "@leadpilot/db";
import type { ContentInsightActionResult, FirmContentRecommendation } from "@leadpilot/shared";
import { parseContentInsightRequest } from "./validators";

export const getFirmContentRecommendations = createServerFn({ method: "GET" })
  .validator((data: unknown) => parseContentInsightRequest(data))
  .handler(async ({ data }) => {
    const result = await listFirmContentRecommendationsBySlug(data);
    if (result.kind !== "ok") {
      return { kind: result.kind, recommendations: [] as FirmContentRecommendation[] };
    }
    return { kind: "ok" as const, recommendations: result.recommendations };
  });

export const runContentInsightAnalysis = createServerFn({ method: "POST" })
  .validator((data: unknown) => parseContentInsightRequest(data))
  .handler(async ({ data }): Promise<ContentInsightActionResult> => {
    try {
      return await runOnDemandContentInsight(data);
    } catch (error) {
      return {
        kind: "failed",
        runId: "recording_failed",
        message:
          error instanceof Error
            ? error.message
            : "Content insight run failed and could not be recorded.",
      };
    }
  });
