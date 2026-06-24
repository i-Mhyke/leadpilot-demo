import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { splitSqlStatements } from "./sql-statements.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "../migrations");

describe("splitSqlStatements", () => {
  it("splits multi-statement migration files", async () => {
    const body = await readFile(join(migrationsDir, "001_firm_instance.sql"), "utf8");
    const statements = splitSqlStatements(body);

    expect(statements.length).toBeGreaterThan(1);
    expect(statements[0]).toContain("CREATE TABLE IF NOT EXISTS firms");
    expect(statements.at(-1)).toContain("idx_firm_services_firm_active");
  });

  it("keeps DO blocks as a single statement", async () => {
    const body = await readFile(join(migrationsDir, "006_runtime_hardening.sql"), "utf8");
    const statements = splitSqlStatements(body);

    expect(statements).toHaveLength(3);
    expect(statements[2]).toContain("DO $$");
    expect(statements[2]).toContain("END $$");
  });

  it("keeps firm knowledge migration constraints intact", async () => {
    const body = await readFile(join(migrationsDir, "009_firm_knowledge_base.sql"), "utf8");
    const statements = splitSqlStatements(body);
    const combined = statements.join("\n");

    expect(combined).toContain("CREATE TABLE IF NOT EXISTS firm_knowledge_documents");
    expect(combined).toContain("CREATE TABLE IF NOT EXISTS firm_knowledge_chunks");
    expect(combined).toContain("fk_firm_kb_chunk_document_owner");
    expect(combined).toContain("idx_firm_kb_one_published_source");
    expect(combined).toContain("retrieval_scope");
    expect(combined).toContain("result_sources");
    expect(combined).toContain("degraded_sources");
    expect(combined).toContain("resolve_firm_knowledge_draft");
    expect(combined).toContain("replace_firm_knowledge_draft_chunks");
    expect(combined).toContain("publish_firm_knowledge_draft");
    expect(combined).toContain("restore_archived_firm_knowledge_document");

    const functionStatements = statements.filter((statement) =>
      statement.includes("CREATE OR REPLACE FUNCTION"),
    );
    expect(functionStatements).toHaveLength(4);
    for (const statement of functionStatements) {
      expect(statement).toContain("$$");
      expect(statement.trimEnd()).toMatch(/\$\$$/);
    }
  });

  it("deduplicates duplicate open bookings before enforcing uniqueness", async () => {
    const body = await readFile(join(migrationsDir, "010_turn_write_idempotency.sql"), "utf8");
    const statements = splitSqlStatements(body);
    const combined = statements.join("\n");

    expect(combined).toContain("duplicate_open_bookings");
    expect(combined).toContain("uq_booking_requests_open_conversation");
    expect(combined).toContain("idx_lead_score_events_idempotency_key");
    expect(combined).toContain("idx_booking_requests_idempotency_key");

    const dedupeIndex = combined.indexOf("duplicate_open_bookings");
    const uniqueIndex = combined.indexOf("uq_booking_requests_open_conversation");
    expect(dedupeIndex).toBeGreaterThan(-1);
    expect(uniqueIndex).toBeGreaterThan(dedupeIndex);
  });

  it("replaces partial idempotency indexes with full unique indexes", async () => {
    const body = await readFile(join(migrationsDir, "011_fix_idempotency_unique_indexes.sql"), "utf8");
    const statements = splitSqlStatements(body);
    const combined = statements.join("\n");

    expect(combined).toContain("DROP INDEX IF EXISTS idx_lead_score_events_idempotency_key");
    expect(combined).toContain("ON lead_score_events (idempotency_key)");
    expect(combined).not.toContain("WHERE idempotency_key IS NOT NULL");
  });
});
