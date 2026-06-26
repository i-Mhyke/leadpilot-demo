import { createServerFn } from "@tanstack/react-start";
import {
  getFirmBookingDetailBySlug,
  getFirmDashboardOverviewBySlug,
  listFirmBookingRequestItemsBySlug,
  listFirmConversationLeadsBySlug,
  recordFirmPageVisit,
} from "@leadpilot/db";
import type {
  FirmBookingDetailResult,
  FirmBookingRequestsResult,
  FirmConversationLeadsResult,
  FirmDashboardResult,
} from "@leadpilot/shared";
import { parseFirmConversationRequest, parseFirmSlugRequest } from "./validators";

export const getFirmDashboardOverview = createServerFn({ method: "GET" })
  .validator((data: unknown) => parseFirmSlugRequest(data))
  .handler(async ({ data }): Promise<FirmDashboardResult> => {
    const result = await getFirmDashboardOverviewBySlug(data.firmSlug);
    if (result.kind === "ok") {
      void recordFirmPageVisit({ firmId: result.overview.firm.id, pageKey: "dashboard" }).catch(
        () => undefined,
      );
    }
    return result;
  });

export const getFirmConversationLeads = createServerFn({ method: "GET" })
  .validator((data: unknown) => parseFirmSlugRequest(data))
  .handler(async ({ data }): Promise<FirmConversationLeadsResult> => {
    return listFirmConversationLeadsBySlug(data.firmSlug);
  });

export const getFirmBookingRequests = createServerFn({ method: "GET" })
  .validator((data: unknown) => parseFirmSlugRequest(data))
  .handler(async ({ data }): Promise<FirmBookingRequestsResult> => {
    return listFirmBookingRequestItemsBySlug(data.firmSlug);
  });

export const getFirmBookingDetail = createServerFn({ method: "GET" })
  .validator((data: unknown) => parseFirmConversationRequest(data))
  .handler(async ({ data }): Promise<FirmBookingDetailResult> => {
    return getFirmBookingDetailBySlug(data.firmSlug, data.conversationId);
  });
