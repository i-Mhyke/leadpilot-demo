import { describe, expect, it } from "vitest";
import {
  isFirmPeopleRoutingQuestion,
  visitorMessageText,
} from "../../src/agent/lib/knowledge-routing.ts";

describe("knowledge routing", () => {
  it("detects follow-up firm people questions", () => {
    expect(
      isFirmPeopleRoutingQuestion("who within the firm should be able to help with this?"),
    ).toBe(true);
    expect(isFirmPeopleRoutingQuestion("Who works on data protection?")).toBe(true);
    expect(isFirmPeopleRoutingQuestion("What is your mission?")).toBe(false);
  });

  it("extracts visitor message text from common shapes", () => {
    expect(visitorMessageText("hello")).toBe("hello");
    expect(visitorMessageText({ text: "who can help?" })).toBe("who can help?");
    expect(visitorMessageText({ message: "who in the firm?" })).toBe("who in the firm?");
  });
});
