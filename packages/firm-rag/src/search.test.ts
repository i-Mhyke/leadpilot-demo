import { describe, expect, it } from "vitest";
import type { FirmKnowledgeChunkRow } from "@leadpilot/db";
import { filterSemanticRowsByFloor, fuseFirmSearchResults, isTeamPeopleQuery } from "./search.ts";

function row(partial: Partial<FirmKnowledgeChunkRow> & { chunk_id: string }): FirmKnowledgeChunkRow {
  return {
    document_id: "doc-1",
    source_key: "website-company-profile",
    title: "Profile",
    source_uri: null,
    heading_path: [],
    content_type: "overview",
    text: "sample",
    metadata: {},
    ...partial,
  };
}

describe("firm search fusion", () => {
  it("shouldFuseLexicalAndSemanticRanksWithoutDuplicates", () => {
    const fused = fuseFirmSearchResults({
      query: "privacy",
      semanticRows: [row({ chunk_id: "a", similarity: 0.9, text: "semantic" })],
      lexicalRows: [row({ chunk_id: "a", lexical_rank: 0.8, text: "lexical" }), row({ chunk_id: "b" })],
      limit: 6,
    });
    expect(fused).toHaveLength(2);
    expect(fused[0]?.chunkId).toBe("a");
  });

  it("shouldPreferNamedPersonChunksForTeamPeopleQueries", () => {
    expect(
      isTeamPeopleQuery("E&C Legal team regulatory compliance manufacturing lawyer"),
    ).toBe(true);
    const fused = fuseFirmSearchResults({
      query: "E&C Legal team regulatory compliance manufacturing lawyer",
      semanticRows: [
        row({
          chunk_id: "compliance",
          content_type: "compliance",
          text: "Regulatory filings and statutory returns.",
        }),
        row({
          chunk_id: "ibukun",
          content_type: "person",
          heading_path: ["Profile", "Team", "Ibukunoluwa Okunola"],
          text: "Regulatory Compliance unit for corporate governance.",
        }),
      ],
      lexicalRows: [
        row({
          chunk_id: "tagline",
          content_type: "person",
          heading_path: ["Profile", "Team"],
          text: "Great legal work starts with great people.",
        }),
      ],
      limit: 3,
    });
    expect(fused[0]?.chunkId).toBe("ibukun");
    expect(fused[0]?.informationalOnly).toBe(true);
  });

  it("shouldPreferExactPersonNameWithoutCreatingRoutingData", () => {
    const fused = fuseFirmSearchResults({
      query: "Jane Doe",
      semanticRows: [],
      lexicalRows: [
        row({ chunk_id: "person", content_type: "person", text: "Jane Doe leads privacy." }),
        row({ chunk_id: "other", text: "General firm overview." }),
      ],
    });
    expect(fused[0]?.informationalOnly).toBe(true);
    expect(fused[0]?.chunkId).toBe("person");
  });

  it("shouldReturnEmptyWhenAllScoresAreBelowFloor", () => {
    const filtered = filterSemanticRowsByFloor(
      [row({ chunk_id: "low", similarity: 0.1 })],
      0.45,
      [],
    );
    expect(filtered).toHaveLength(0);
  });

  it("shouldBoundSnippetAndResultCount", () => {
    const fused = fuseFirmSearchResults({
      query: "firm",
      semanticRows: Array.from({ length: 10 }, (_, index) =>
        row({ chunk_id: `chunk-${index}`, similarity: 0.9 - index * 0.01 }),
      ),
      lexicalRows: [],
      limit: 6,
    });
    expect(fused).toHaveLength(6);
    const long = "x".repeat(1000);
    const bounded = fuseFirmSearchResults({
      query: "firm",
      semanticRows: [row({ chunk_id: "long", text: long })],
      lexicalRows: [],
    });
    expect(bounded[0]?.text.length).toBeLessThanOrEqual(900);
  });
});
