#!/usr/bin/env tsx
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createFirm, deleteFirmBySlug, getSql, saveFirmBrainConfig } from "@leadpilot/db";
import {
  FIRM_JURISDICTION_OPTIONS,
  resolveFirmJurisdiction,
  type FirmIndustry,
} from "@leadpilot/shared";
import { ingestUploadedFirmKnowledgeMarkdown } from "@leadpilot/firm-rag";

type DemoFirmFiles = {
  folderName: string;
  profilePath: string;
  brainPath: string;
};

type DemoFirmImportResult = {
  folderName: string;
  firmName: string;
  slug: string;
  jurisdiction: string;
  knowledgeRevision: number;
  brainRevision: number;
  knowledgeHash: string;
  brainHash: string;
  status: "created" | "reused";
};

type ScriptOptions = {
  reset: boolean;
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const demoKbRoot = path.join(repoRoot, "demos_kb");
const supportedJurisdictions = FIRM_JURISDICTION_OPTIONS.map((entry) => entry.name);
const jurisdictionAliases = new Map<string, string>([
  ["england", "United Kingdom"],
  ["scotland", "United Kingdom"],
  ["wales", "United Kingdom"],
  ["northern ireland", "United Kingdom"],
  ["uk", "United Kingdom"],
  ["u.k.", "United Kingdom"],
  ["u k", "United Kingdom"],
  ["britain", "United Kingdom"],
  ["great britain", "United Kingdom"],
  ["usa", "United States"],
  ["u.s.a.", "United States"],
  ["u s a", "United States"],
  ["us", "United States"],
  ["u.s.", "United States"],
]);

function parseArgs(argv: string[]): ScriptOptions {
  return {
    reset: argv.includes("--reset"),
  };
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findFirstWholeWordMatch(text: string, candidate: string): number {
  const escaped = escapeRegExp(candidate.trim());
  if (!escaped) return -1;
  const pattern = new RegExp(`(^|[^A-Za-z0-9])${escaped}(?=$|[^A-Za-z0-9])`, "i");
  const match = pattern.exec(text);
  if (!match) return -1;
  return match.index + match[1]!.length;
}

function extractFirmName(profileMarkdown: string, fallbackName: string): string {
  const firstHeading = profileMarkdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (!firstHeading) {
    return fallbackName;
  }

  const cleaned = firstHeading
    .replace(/\s+[—-]\s+Company Profile$/i, "")
    .replace(/\s+[—-]\s+Profile$/i, "")
    .trim();

  return cleaned || fallbackName;
}

function locateCountryMentions(text: string): Array<{ jurisdiction: string; index: number }> {
  const matches: Array<{ jurisdiction: string; index: number }> = [];

  for (const jurisdiction of supportedJurisdictions) {
    const index = findFirstWholeWordMatch(text, jurisdiction);
    if (index >= 0) {
      matches.push({ jurisdiction, index });
    }
  }

  return matches.sort((left, right) => left.index - right.index);
}

function inferJurisdiction(profileMarkdown: string): string {
  const lines = profileMarkdown.split("\n");
  const candidateLines = lines.filter((line) =>
    /headquarters?|office|offices|location|locations|based in|country|jurisdiction/i.test(line),
  );
  const searchOrder = [...candidateLines, ...lines];

  for (const line of searchOrder) {
    for (const [alias, jurisdiction] of jurisdictionAliases) {
      if (findFirstWholeWordMatch(line, alias) >= 0) {
        return jurisdiction;
      }
    }

    const lineMatches = locateCountryMentions(line);
    if (lineMatches[0]) {
      return resolveFirmJurisdiction(lineMatches[0].jurisdiction) ?? lineMatches[0].jurisdiction;
    }
  }

  throw new Error("Could not infer a jurisdiction from the profile markdown.");
}

async function cleanupExistingDemoFirms(profilePaths: string[]): Promise<void> {
  const sql = getSql();
  const seenSlugs = new Set<string>();

  for (const profilePath of profilePaths) {
    const profileMarkdown = await readFile(profilePath, "utf8");
    const firmName = extractFirmName(profileMarkdown, path.basename(path.dirname(profilePath)));
    const rows = await sql<{ slug: string }[]>`
      SELECT slug
      FROM firms
      WHERE lower(name) = lower(${firmName})
    `;

    for (const row of rows) {
      if (seenSlugs.has(row.slug)) continue;
      seenSlugs.add(row.slug);
      await deleteFirmBySlug(row.slug);
      console.log(`deleted slug=${row.slug} name=${firmName}`);
    }
  }
}

async function loadDemoFirmFiles(rootDir: string): Promise<DemoFirmFiles[]> {
  const folders = (await readdir(rootDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const files: DemoFirmFiles[] = [];
  for (const folderName of folders) {
    const folderPath = path.join(rootDir, folderName);
    const profilePath = path.join(folderPath, `${folderName.replace(/-/g, "_")}_company_profile.md`);
    const brainPath = path.join(folderPath, `${folderName.replace(/-/g, "_")}_company_brain.md`);

    try {
      await readFile(profilePath, "utf8");
      await readFile(brainPath, "utf8");
      files.push({ folderName, profilePath, brainPath });
    } catch {
      // Ignore folders that do not contain a matching profile + brain pair.
    }
  }

  return files.sort((left, right) => left.folderName.localeCompare(right.folderName));
}

async function importDemoFirm(files: DemoFirmFiles): Promise<DemoFirmImportResult> {
  const profileMarkdown = await readFile(files.profilePath, "utf8");
  const brainMarkdown = await readFile(files.brainPath, "utf8");
  const firmName = extractFirmName(profileMarkdown, normalizeWhitespace(files.folderName));
  const jurisdiction = inferJurisdiction(profileMarkdown);
  const firm = await createFirm({
    name: firmName,
    industry: "legal" satisfies FirmIndustry,
    jurisdiction,
  });

  const brainConfig = await saveFirmBrainConfig({
    firmId: firm.id,
    sourceFilename: path.basename(files.brainPath),
    contentMarkdown: brainMarkdown,
  });

  const knowledgeResult = await ingestUploadedFirmKnowledgeMarkdown({
    firmId: firm.id,
    firmSlug: firm.slug,
    firmDisplayName: firm.name,
    contentMarkdown: profileMarkdown,
  });

  return {
    folderName: files.folderName,
    firmName: firm.name,
    slug: firm.slug,
    jurisdiction: firm.jurisdiction ?? jurisdiction,
    knowledgeRevision: knowledgeResult.revision,
    brainRevision: brainConfig.revision,
    knowledgeHash: knowledgeResult.contentHash,
    brainHash: brainConfig.contentHash,
    status: knowledgeResult.revision === 1 && brainConfig.revision === 1 ? "created" : "reused",
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) {
    throw new Error("OPENAI_API_KEY is required for KB ingestion.");
  }

  const demoFirmFiles = await loadDemoFirmFiles(demoKbRoot);
  if (demoFirmFiles.length === 0) {
    throw new Error("No demo KB folders with matching profile and brain files were found.");
  }

  if (options.reset) {
    await cleanupExistingDemoFirms(demoFirmFiles.map((files) => files.profilePath));
  }

  const results: DemoFirmImportResult[] = [];
  const failures: Array<{ folderName: string; error: string }> = [];

  for (const files of demoFirmFiles) {
    try {
      const result = await importDemoFirm(files);
      results.push(result);
      console.log(
        [
          `folder=${result.folderName}`,
          `firm=${result.firmName}`,
          `slug=${result.slug}`,
          `jurisdiction=${result.jurisdiction}`,
          `knowledge_revision=${result.knowledgeRevision}`,
          `brain_revision=${result.brainRevision}`,
          `knowledge_hash=${result.knowledgeHash}`,
          `brain_hash=${result.brainHash}`,
          `status=${result.status}`,
        ].join(" "),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ folderName: files.folderName, error: message });
      console.error(`folder=${files.folderName} error=${message}`);
    }
  }

  console.log(
    `imported=${results.length} failed=${failures.length} total=${demoFirmFiles.length}`,
  );

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
