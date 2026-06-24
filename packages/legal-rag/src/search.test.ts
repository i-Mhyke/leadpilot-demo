import { describe, expect, it } from "vitest";
import { rankLegalResults } from "./rank.ts";

describe("rankLegalResults", () => {
  it("merges semantic and exact results without duplicate chunks", () => {
    const ranked = rankLegalResults({
      semanticResults: [
        {
          chunkId: "a",
          parentUnitId: "u1",
          documentId: "d1",
          citation: "NDPR s.2",
          sourceFile: "ndpr.pdf",
          text: "Definitions",
          similarity: 0.7,
        },
      ],
      exactResults: [
        {
          chunkId: "a",
          parentUnitId: "u1",
          documentId: "d1",
          citation: "NDPR s.2",
          sourceFile: "ndpr.pdf",
          text: "Definitions",
          exactMatchScore: 1,
        },
      ],
      graphResults: [],
      limit: 3,
    });

    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.exactMatchScore).toBe(1);
    expect(ranked[0]?.similarity).toBe(0.7);
  });
});
