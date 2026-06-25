import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { clearStoredSessionsForFirm, useDemoSessions } from "./use-demo-sessions";

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

  it("clears stored sessions for one firm without touching others", () => {
    window.localStorage.setItem(
      "leadpilot.demo.sessions",
      JSON.stringify([
        {
          id: "session-1",
          firmSlug: "avance",
          customerName: "New conversation",
          matterLabel: "No topic yet",
          updatedAt: "2026-06-24T15:00:00.000Z",
        },
        {
          id: "session-2",
          firmSlug: "demo-law",
          customerName: "New conversation",
          matterLabel: "No topic yet",
          updatedAt: "2026-06-24T15:00:00.000Z",
        },
      ]),
    );
    window.localStorage.setItem(
      "leadpilot.demo.activeSessionId",
      JSON.stringify({ avance: "session-1", "demo-law": "session-2" }),
    );

    clearStoredSessionsForFirm("avance");

    expect(JSON.parse(window.localStorage.getItem("leadpilot.demo.sessions") ?? "[]")).toEqual([
      expect.objectContaining({ firmSlug: "demo-law" }),
    ]);
    expect(JSON.parse(window.localStorage.getItem("leadpilot.demo.activeSessionId") ?? "{}")).toEqual({
      "demo-law": "session-2",
    });
  });
});
