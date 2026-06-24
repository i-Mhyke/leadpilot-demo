import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { getFirmProfileBySlug } from "@leadpilot/db";

function r(v: unknown) { return JSON.parse(JSON.stringify(v)); }

export function createGetFirmProfileTool(firmSlug: string) {
  return defineTool({
    name: "get_firm_profile",
    description: "Load full firm profile JSON.",
    input: v.object({}),
    async run() {
      const profile = await getFirmProfileBySlug(firmSlug);
      if ("kind" in profile) return r({ found: false, error: profile.kind === "inactive" ? "firm_inactive" : "firm_not_found" });
      return r({ found: true, firmName: profile.firm.name, services: profile.services.map(s => ({ id: s.id, name: s.name })) });
    },
  });
}
