import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useDemoSessions } from "./use-demo-sessions";

describe("useDemoSessions", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("collapses legacy seeded chats to a single default conversation", async () => {
    window.localStorage.setItem(
      "leadpilot.demo.sessions",
      JSON.stringify([
        {
          id: "session-1",
          firmSlug: "avance",
          customerName: "Amara Okonkwo",
          matterLabel: "SAFE notes, seed round",
          updatedAt: "2026-06-24T15:00:00.000Z",
        },
        {
          id: "session-2",
          firmSlug: "avance",
          customerName: "Theo Whitfield",
          matterLabel: "NDPR readiness review",
          updatedAt: "2026-06-24T15:00:00.000Z",
        },
        {
          id: "session-3",
          firmSlug: "avance",
          customerName: "Priya Mehta",
          matterLabel: "Remittance API licensing",
          updatedAt: "2026-06-24T15:00:00.000Z",
        },
      ]),
    );

    const { result } = renderHook(() => useDemoSessions("avance"));

    await waitFor(() => {
      expect(result.current.hydrated).toBe(true);
    });

    expect(result.current.sessions).toHaveLength(1);
    expect(result.current.sessions[0]?.customerName).toBe("New conversation");
    expect(result.current.sessions[0]?.matterLabel).toBe("No topic yet");
  });
});
