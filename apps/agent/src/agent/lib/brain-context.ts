import type { FirmBrainSnapshot } from "@leadpilot/shared";

export function brainContextForModel(snapshot: FirmBrainSnapshot): string[] {
  const compiled = snapshot.compiled;
  const lines: string[] = [
    `Brain revision: ${snapshot.revision}`,
    `Brain hash: ${snapshot.contentHash}`,
    `Brain compiled at: ${snapshot.compiledAt}`,
  ];

  if (compiled.businessSummary) {
    lines.push(`Business summary: ${compiled.businessSummary}`);
  }

  const toneParts = [
    compiled.tone.voice ? `voice: ${compiled.tone.voice}` : "",
    compiled.tone.formalityLevel ? `formality: ${compiled.tone.formalityLevel}` : "",
    compiled.tone.preferredGreeting ? `preferred greeting: ${compiled.tone.preferredGreeting}` : "",
    compiled.tone.notes.length > 0 ? `notes: ${compiled.tone.notes.join(" | ")}` : "",
  ].filter(Boolean);
  if (toneParts.length > 0) {
    lines.push(`Tone: ${toneParts.join(" | ")}`);
  }

  if (compiled.greeting) {
    lines.push(`Greeting: ${compiled.greeting}`);
  }
  if (compiled.qualificationPosture.length > 0) {
    lines.push(`Qualification posture: ${compiled.qualificationPosture.join(" | ")}`);
  }
  if (compiled.escalationRules.length > 0) {
    lines.push(`Escalation rules: ${compiled.escalationRules.join(" | ")}`);
  }
  if (compiled.forbiddenClaims.length > 0) {
    lines.push(`Forbidden claims: ${compiled.forbiddenClaims.join(" | ")}`);
  }
  if (compiled.serviceEmphasis.length > 0) {
    lines.push(`Service emphasis: ${compiled.serviceEmphasis.join(" | ")}`);
  }

  return lines;
}
