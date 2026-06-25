import type { FirmAgentProfile, FirmBrainSnapshot } from "@leadpilot/shared";
import { brainContextForModel } from "./brain-context.ts";
import { firmProfileContextForModel } from "./firm-context.ts";
import { isNigerianFirmCountry } from "./country.ts";

function legalKnowledgeContextForModel(profile: FirmAgentProfile): string[] {
  if (!isNigerianFirmCountry(profile.firm.jurisdiction)) {
    return [
      "Legal retrieval policy: Nigerian legal KB disabled for this firm.",
      'Never call `search_knowledge` with scope "legal" or "both". Use the firm profile plus general model knowledge only, and keep legal guidance high-level.',
    ];
  }

  return [
    "Legal retrieval policy: Nigerian legal KB enabled for this firm.",
    'Use `search_knowledge` with scope "legal" or "both" only for specific Nigerian legal or regulatory questions.',
  ];
}

export function composeLeadPilotInstructions(input: {
  baseInstructions: string;
  profile: FirmAgentProfile | null;
  brainSnapshot?: FirmBrainSnapshot | null;
}): string {
  const profileLines = input.profile ? firmProfileContextForModel(input.profile) : [];
  const legalLines = input.profile ? legalKnowledgeContextForModel(input.profile) : [];
  const brainLines = input.brainSnapshot ? brainContextForModel(input.brainSnapshot) : [];

  return [
    input.baseInstructions,
    "",
    ...(profileLines.length > 0 ? ["## Injected Company Context", ...profileLines] : []),
    ...(legalLines.length > 0 ? ["", "## Injected Legal Policy", ...legalLines] : []),
    ...(brainLines.length > 0 ? ["", "## Injected Brain Context", ...brainLines] : []),
  ].join("\n");
}
