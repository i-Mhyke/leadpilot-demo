import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { EveMessage } from "../use-flue-agent";
import { ChatMessage } from "./chat-message";

describe("ChatMessage", () => {
  it("does not render raw provider thinking fallback text", () => {
    const message = {
      id: "assistant-1",
      role: "assistant",
      metadata: {},
      parts: [
        {
          type: "text",
          text: "Hi, I'm the intake assistant for E&C Legal.\n\n(Empty response: {'content': [{'type': 'thinking', 'thinking': 'internal reasoning', 'signature': 'signed'}]})",
        },
      ],
    } as unknown as EveMessage;

    render(<ChatMessage message={message} />);

    expect(screen.getByText(/intake assistant for E&C Legal/i)).toBeInTheDocument();
    expect(screen.queryByText(/Empty response/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/internal reasoning/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/signature/i)).not.toBeInTheDocument();
  });

  it("strips the booking schedule marker from assistant text", () => {
    const message = {
      id: "assistant-2",
      role: "assistant",
      metadata: {
        ui: {
          bookingScheduleRequested: true,
        },
      },
      parts: [
        {
          type: "text",
          text: "What day and time would you prefer?\n[[leadpilot.booking_schedule_requested]]",
        },
      ],
    } as unknown as EveMessage;

    render(<ChatMessage message={message} />);

    expect(screen.getByText(/What day and time would you prefer/i)).toBeInTheDocument();
    expect(screen.queryByText(/\[\[leadpilot\.booking_schedule_requested\]\]/i)).not.toBeInTheDocument();
  });
});
