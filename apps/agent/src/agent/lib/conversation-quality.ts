const FORBIDDEN = [/\\bdemo-law\\b/i, /\\bfresh conversation\\b/i, /\\bnew thread\\b/i];
const APPOINTMENT = [/\\bappointment (is )?confirmed\\b/i, /\\byou(?:'re| are) booked\\b/i];
const EARLY_CONTACT = [/\\bwhat(?:'s| is) your email\\b/i, /\\bmay i (?:take|have|get) your email\\b/i];

export type Violation = { code: string; message: string };

export function findForbiddenInternalWording(text: string): string | undefined {
  if (!text || typeof text !== "string") return undefined;
  const patterns = [/internal (policy|process|tool|system)/i, /backend/i, /rephrased/i, /as an ai/i];
  for (const p of patterns) { if (p.test(text)) return p.source; }
  return undefined;
}

export function findAppointmentConfirmedWording(text: string): string | undefined {
  if (!text || typeof text !== "string") return undefined;
  const patterns = [/appointment.*(confirm|book|schedule)/i, /meeting.*(set|confirm)/i];
  for (const p of patterns) { if (p.test(text)) return p.source; }
  return undefined;
}

export function findEarlyContactCaptureWording(text: string): string | undefined {
  if (!text || typeof text !== "string") return undefined;
  const patterns = [/email.*(ask|request|need)/i, /phone.*(number|contact)/i];
  for (const p of patterns) { if (p.test(text)) return p.source; }
  return undefined;
}

export function findEmDashWording(text: string): string | undefined {
  if (!text || typeof text !== "string") return undefined;
  if (text.includes("\u2014") || text.includes("--")) return "emdash";
  return undefined;
}

export function assertConversationQuality(text: string, rules: Record<string, boolean | number> = {}): void {
  const violations: Violation[] = [];
  if (rules.forbidInternalWording) {
    const v = findForbiddenInternalWording(text);
    if (v) violations.push({ code: "internal_wording", message: v });
  }
  if (rules.forbidEmDash) {
    const v = findEmDashWording(text);
    if (v) violations.push({ code: "em_dash", message: v });
  }
  if (violations.length > 0) {
    throw new Error(violations.map(v => `${v.code}: ${v.message}`).join("; "));
  }
}
