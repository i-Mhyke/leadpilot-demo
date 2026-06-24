import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { splitSqlStatements } from "./sql-statements.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "../migrations");

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const sql = neon(databaseUrl);
  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const body = await readFile(join(migrationsDir, file), "utf8");
    const statements = splitSqlStatements(body);
    console.log(`Applying ${file} (${statements.length} statements)...`);

    for (const [index, statement] of statements.entries()) {
      await sql.query(statement);
      console.log(`  ✓ ${file} [${index + 1}/${statements.length}]`);
    }
  }

  console.log("Migrations complete.");
  console.log(
    "Reminder: legal retrieval requires migration 006_runtime_hardening.sql (firm-scoped chunks + retrieval audit columns).",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
