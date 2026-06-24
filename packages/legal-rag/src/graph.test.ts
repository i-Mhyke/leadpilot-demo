import { describe, expect, it } from "vitest";
import { expandGraph } from "./graph.ts";

describe("expandGraph", () => {
  it("returns no neighbours for an empty seed set", async () => {
    await expect(expandGraph({ chunkIds: [], limit: 3, firmId: "firm-a" })).resolves.toEqual([]);
  });
});
