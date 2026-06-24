import { getFirmBySlug } from "@leadpilot/db";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class StaffScopeError extends Error {
  constructor(m: string) { super(m); this.name = "StaffScopeError"; }
}

export async function requireStaffFirmId(): Promise<string> {
  const raw = process.env.LEADPILOT_STAFF_ANALYTICS === "true" ? process.env.LEADPILOT_STAFF_FIRM_ID?.trim() : undefined;
  if (!raw) throw new StaffScopeError("Analytics tools require staff authentication.");
  if (UUID_RE.test(raw)) return raw;
  const firm = await getFirmBySlug(raw);
  if ("kind" in firm) throw new StaffScopeError("Unknown firm for staff analytics.");
  return firm.id;
}
