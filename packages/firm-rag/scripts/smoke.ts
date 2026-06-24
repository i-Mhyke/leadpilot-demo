#!/usr/bin/env tsx
import { neon } from "@neondatabase/serverless";
import {
  createOrReuseFirmKnowledgeDraft,
  publishFirmKnowledgeDraft,
  replaceFirmKnowledgeDraftChunks,
  restoreArchivedFirmKnowledgeDocument,
  semanticSearchFirmKnowledge,
} from "@leadpilot/db";

function fakeVector(seed: number): number[] {
  return Array.from({ length: 1536 }, (_, index) => ((seed + index) % 97) / 100);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for firm-rag smoke tests");
  }

  const firmSlugArg = process.argv.find((arg) => arg.startsWith("--firm-slug="))?.split("=")[1]
    ?? process.argv[process.argv.indexOf("--firm-slug") + 1]
    ?? "demo-law";

  const sql = neon(databaseUrl);
  const tempSlug = `firm-kb-smoke-${Date.now()}`;

  try {
    const tempFirms = await sql`
      INSERT INTO firms (name, slug, industry, jurisdiction, website_url, status)
      VALUES ('Smoke Firm', ${tempSlug}, 'legal', 'Nigeria', 'https://example.com', 'active')
      RETURNING id
    `;
    const tempFirmId = (tempFirms as Array<{ id: string }>)[0]!.id;

    const demoFirm = await sql`
      SELECT id FROM firms WHERE slug = ${firmSlugArg} LIMIT 1
    `;
    if (!(demoFirm as Array<{ id: string }>)[0]) {
      throw new Error(`Unknown firm slug: ${firmSlugArg}`);
    }

    const demoResults = await semanticSearchFirmKnowledge({
      firmId: (demoFirm as Array<{ id: string }>)[0].id,
      embedding: fakeVector(1),
      embeddingModel: "text-embedding-3-small",
      embeddingDimensions: 1536,
      limit: 3,
      minSimilarity: 0,
    });

    const tempResults = await semanticSearchFirmKnowledge({
      firmId: tempFirmId,
      embedding: fakeVector(1),
      embeddingModel: "text-embedding-3-small",
      embeddingDimensions: 1536,
      limit: 3,
      minSimilarity: 0,
    });

    console.log(`demo_results=${demoResults.rows.length}`);
    console.log(`temp_results=${tempResults.rows.length}`);

    if (demoResults.rows.length === 0) {
      throw new Error("Expected demo-law to return published firm knowledge chunks");
    }
    if (tempResults.rows.length !== 0) {
      throw new Error("Temporary firm must not retrieve demo-law chunks");
    }
  } finally {
    await sql`DELETE FROM firms WHERE slug = ${tempSlug}`;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
