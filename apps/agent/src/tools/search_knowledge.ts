import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { searchFirmKnowledge } from "@leadpilot/firm-rag";
import { getFirmProfileBySlug } from "@leadpilot/db";
import { searchLegalKnowledge } from "@leadpilot/legal-rag";
import { isNigerianFirmCountry } from "../agent/lib/country.ts";
import { requireSessionBinding } from "../agent/lib/session-scope.ts";

function r(v: unknown) { return JSON.parse(JSON.stringify(v)); }

export function createSearchKnowledgeTool(firmSlug: string, browserSessionId: string) {
  return defineTool({
    name: "search_knowledge",
    description: "Search firm and/or Nigerian legal knowledge.",
    input: v.object({
      query: v.pipe(v.string(), v.minLength(3), v.maxLength(300)),
      scope: v.picklist(["firm", "legal", "both"]),
      limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(8)), 6),
    }),
    async run({ input }: { input: { query: string; scope: "firm" | "legal" | "both"; limit: number } }) {
      const binding = await requireSessionBinding(firmSlug, browserSessionId);
      const profile = await getFirmProfileBySlug(firmSlug);
      const canUseNigerianLegalKnowledge = !("kind" in profile) && isNigerianFirmCountry(profile.firm.jurisdiction);
      const evidence: Array<Record<string, unknown>> = [];
      if (input.scope !== "legal") {
        const firmRes = await searchFirmKnowledge({
          query: input.query, firmId: binding.firmId,
          conversationId: binding.conversationId, limit: input.limit, auditMode: "deferred",
        });
        if (firmRes.status !== "failed") {
          evidence.push(...firmRes.results.map(rr => ({ source: "firm", title: rr.title, text: rr.text })));
        }
      }
      if (input.scope !== "firm" && canUseNigerianLegalKnowledge) {
        const legalRes = await searchLegalKnowledge({
          query: input.query, firmId: binding.firmId,
          conversationId: binding.conversationId, limit: input.limit, auditMode: "deferred",
        });
        if (legalRes.status !== "failed") {
          evidence.push(...legalRes.results.map(rr => ({ source: "legal", title: rr.citation, text: rr.text })));
        }
      }
      return r({ status: evidence.length === 0 ? "empty" : "ok", evidence });
    },
  });
}
