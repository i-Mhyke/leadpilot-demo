#!/usr/bin/env tsx
import { ingestManifest } from "../src/ingestion.ts";

function parseArgs(argv: string[]) {
  let manifestPath = "";
  let publish = false;
  let dryRun = true;
  let sourceKey: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--manifest") {
      manifestPath = argv[++i] ?? "";
    } else if (arg === "--publish") {
      publish = true;
      dryRun = false;
    } else if (arg === "--dry-run") {
      dryRun = true;
      publish = false;
    } else if (arg === "--source-key") {
      sourceKey = argv[++i];
    }
  }

  if (!manifestPath) {
    throw new Error("--manifest is required");
  }

  return { manifestPath, publish, dryRun, sourceKey };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const results = await ingestManifest({
    manifestPath: options.manifestPath,
    publish: options.publish,
    dryRun: options.dryRun,
    sourceKey: options.sourceKey,
  });

  for (const result of results) {
    console.log(
      [
        `firm_slug=${result.firmSlug}`,
        `source_key=${result.sourceKey}`,
        `content_hash=${result.contentHash}`,
        `chunk_count=${result.chunkCount}`,
        `embedding_model=${result.embeddingModel}`,
        `embedding_dimensions=${result.embeddingDimensions}`,
        `resolution_state=${result.resolutionState}`,
        `publication_result=${result.publicationResult ?? "none"}`,
        `embedding_requests=${result.embeddingRequests}`,
        `database_writes=${result.databaseWrites}`,
      ].join(" "),
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
