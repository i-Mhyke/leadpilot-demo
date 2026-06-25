#!/usr/bin/env tsx
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listActiveFirms } from "@leadpilot/db";

type AskPageRow = {
  company_name: string;
  firm_slug: string;
  ask_url: string;
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(repoRoot, "exports", "ask-pages.csv");
const baseUrl = "https://leadpilot.kosinu.com";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsv(rows: AskPageRow[]): string {
  const header = ["company_name", "firm_slug", "ask_url"];
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [row.company_name, row.firm_slug, row.ask_url].map(csvEscape).join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

async function main() {
  const firms = await listActiveFirms();
  const rows = firms
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name))
    .map<AskPageRow>((firm) => ({
      company_name: firm.name,
      firm_slug: firm.slug,
      ask_url: `${baseUrl}/ask/${firm.slug}`,
    }));

  await writeFile(outputPath, toCsv(rows), "utf8");

  console.log(`Wrote ${rows.length} ask-page URLs to ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
