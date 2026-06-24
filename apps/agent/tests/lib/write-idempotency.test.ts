import { describe, expect, it } from "vitest";
import {
  deriveWriteIdempotencyKey,
} from "../../src/agent/lib/write-idempotency.ts";

describe("write-idempotency", () => {
  it("prefers firm conversation turn tool key when turn id is available", () => {
    expect(
      deriveWriteIdempotencyKey({
        firmId: "firm-1",
        conversationId: "conv-1",
        turnId: "turn-1",
        toolName: "upsert_lead",
      }),
    ).toBe("firm-1:conv-1:turn-1:upsert_lead");
  });

  it("falls back to canonical input hash when turn id is unavailable", () => {
    const first = deriveWriteIdempotencyKey({
      firmId: "firm-1",
      conversationId: "conv-1",
      toolName: "upsert_lead",
      canonicalInput: '{"email":"lead@example.com"}',
    });
    const second = deriveWriteIdempotencyKey({
      firmId: "firm-1",
      conversationId: "conv-1",
      toolName: "upsert_lead",
      canonicalInput: '{"email":"lead@example.com"}',
    });
    const different = deriveWriteIdempotencyKey({
      firmId: "firm-1",
      conversationId: "conv-1",
      toolName: "upsert_lead",
      canonicalInput: '{"email":"other@example.com"}',
    });

    expect(first).toBe(second);
    expect(different).not.toBe(first);
  });
});
