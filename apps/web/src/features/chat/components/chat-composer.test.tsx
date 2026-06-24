import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatComposer } from "./chat-composer";

describe("ChatComposer", () => {
  it("shows the booking schedule button when the assistant requests a booking time", () => {
    const onSend = vi.fn();

    render(
      <ChatComposer
        bookingScheduleRequested
        onSend={onSend}
        onBookingConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /select booking schedule/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /select booking schedule/i }));
    expect(onSend).not.toHaveBeenCalled();
  });
});
