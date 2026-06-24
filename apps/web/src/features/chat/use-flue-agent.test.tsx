import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FlueSession } from "./flue-session";
import { useFlueAgent } from "./use-flue-agent";

describe("useFlueAgent", () => {
  it("publishes the active session id after a turn so the chat can resume later", async () => {
    const session = new FlueSession({ host: "", headers: () => ({}) }, { streamIndex: 4 });
    vi.spyOn(session, "send").mockImplementation(async () => {
      session.state.sessionId ??= "sess-123";
      return { sessionId: "sess-123", offset: "-1", result: { text: "What day and time would you prefer?" } };
    });
    const onSessionChange = vi.fn();

    const { result } = renderHook(() =>
      useFlueAgent({
        session,
        onSessionChange,
      }),
    );

    onSessionChange.mockClear();

    await result.current.send("hello");

    await waitFor(() => {
      expect(onSessionChange).toHaveBeenCalledWith({
        streamIndex: 4,
        sessionId: "sess-123",
      });
    });

    await waitFor(() => {
      expect(result.current.data.messages.at(-1)).toMatchObject({
        role: "assistant",
        metadata: {
          ui: {
            bookingScheduleRequested: true,
          },
        },
      });
    });
  });
});
