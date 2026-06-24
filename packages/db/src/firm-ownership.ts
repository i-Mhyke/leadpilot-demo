import { getSql } from "./client.ts";
import { rows as toRows } from "./sql.ts";

export class FirmOwnershipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FirmOwnershipError";
  }
}

const SERVICE_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isServiceId(value: string) {
  return SERVICE_ID_RE.test(value);
}

export async function resolveFirmServiceId(
  firmId: string,
  serviceRef: string,
): Promise<string> {
  if (isServiceId(serviceRef)) {
    await assertFirmService(firmId, serviceRef);
    return serviceRef;
  }

  const sql = getSql();
  const rows = toRows<{ id: string }>(await sql`
    SELECT id
    FROM firm_services
    WHERE firm_id = ${firmId}
      AND slug = ${serviceRef}
      AND is_active = true
    LIMIT 1
  `);

  if (!rows[0]) {
    throw new FirmOwnershipError(`service "${serviceRef}" does not belong to the active firm.`);
  }

  return rows[0].id;
}

export async function assertFirmConversation(firmId: string, conversationId: string): Promise<void> {
  const sql = getSql();
  const matches = toRows<{ id: string }>(await sql`
    SELECT id
    FROM conversations
    WHERE id = ${conversationId}
      AND firm_id = ${firmId}
    LIMIT 1
  `);

  if (!matches[0]) {
    throw new FirmOwnershipError("conversationId does not belong to the active firm.");
  }
}

export async function assertFirmService(firmId: string, serviceId: string): Promise<void> {
  const sql = getSql();
  const matches = toRows<{ id: string }>(await sql`
    SELECT id
    FROM firm_services
    WHERE id = ${serviceId}
      AND firm_id = ${firmId}
      AND is_active = true
    LIMIT 1
  `);

  if (!matches[0]) {
    throw new FirmOwnershipError("serviceId does not belong to the active firm.");
  }
}

export async function assertFirmVisitor(firmId: string, visitorId: string): Promise<void> {
  const sql = getSql();
  const matches = toRows<{ id: string }>(await sql`
    SELECT id
    FROM visitors
    WHERE id = ${visitorId}
      AND firm_id = ${firmId}
    LIMIT 1
  `);

  if (!matches[0]) {
    throw new FirmOwnershipError("visitorId does not belong to the active firm.");
  }
}

export async function assertFirmLeadForConversation(
  firmId: string,
  conversationId: string,
  leadId: string,
): Promise<void> {
  const sql = getSql();
  const matches = toRows<{ id: string }>(await sql`
    SELECT id
    FROM lead_profiles
    WHERE id = ${leadId}
      AND firm_id = ${firmId}
      AND conversation_id = ${conversationId}
    LIMIT 1
  `);

  if (!matches[0]) {
    throw new FirmOwnershipError("leadId does not belong to the active conversation.");
  }
}

export async function getConversationWriteScope(
  firmId: string,
  conversationId: string,
): Promise<{ visitorId: string; leadId?: string }> {
  const sql = getSql();
  const conversations = toRows<{ visitor_id: string }>(await sql`
    SELECT visitor_id
    FROM conversations
    WHERE id = ${conversationId}
      AND firm_id = ${firmId}
    LIMIT 1
  `);

  const conversation = conversations[0];
  if (!conversation) {
    throw new FirmOwnershipError("conversationId does not belong to the active firm.");
  }

  const leads = toRows<{ id: string }>(await sql`
    SELECT id
    FROM lead_profiles
    WHERE firm_id = ${firmId}
      AND conversation_id = ${conversationId}
    LIMIT 1
  `);

  return {
    visitorId: conversation.visitor_id,
    leadId: leads[0]?.id,
  };
}
