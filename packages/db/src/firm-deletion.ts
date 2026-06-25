import type { NeonQueryFunctionInTransaction } from "@neondatabase/serverless";

export type FirmDeletionTarget = {
  firmId: string;
  firmSlug: string;
};

type SqlTag = NeonQueryFunctionInTransaction<false, false>;

/**
 * Tables that do not CASCADE from firms must be deleted explicitly here.
 * firms CASCADE removes services, visitors, conversations, KB, brains, leads, analytics, etc.
 */
export function buildFirmDeletionStatements(
  target: FirmDeletionTarget,
  tx: SqlTag,
) {
  const rateKeyPrefix = `${target.firmSlug}:%`;

  return [
    tx`DELETE FROM retrieval_logs WHERE firm_id = ${target.firmId}`,
    tx`DELETE FROM legal_unit_chunks WHERE firm_id = ${target.firmId}`,
    tx`DELETE FROM request_rate_limits WHERE rate_key LIKE ${rateKeyPrefix}`,
    tx`DELETE FROM firms WHERE id = ${target.firmId}`,
  ];
}
