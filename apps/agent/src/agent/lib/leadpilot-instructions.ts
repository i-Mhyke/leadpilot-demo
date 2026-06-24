import type { FirmAgentProfile, FirmBrainSnapshot } from "@leadpilot/shared";
import { brainContextForModel } from "./brain-context.ts";
import { firmProfileContextForModel } from "./firm-context.ts";

export function composeLeadPilotInstructions(input: {
  baseInstructions: string;
  profile: FirmAgentProfile | null;
  brainSnapshot?: FirmBrainSnapshot | null;
}): string {
  const profileLines = input.profile ? firmProfileContextForModel(input.profile) : [];
  const brainLines = input.brainSnapshot ? brainContextForModel(input.brainSnapshot) : [];

  return [
    input.baseInstructions,
    "",
    ...(profileLines.length > 0 ? ["## Injected Firm Context", ...profileLines] : []),
    ...(brainLines.length > 0 ? ["", "## Injected Brain Context", ...brainLines] : []),
  ].join("\n");
}
