import { describe, expect, it } from "vitest";
import {
  BOOKING_TIME_SLOTS,
  buildBookingMessage,
  buildMonthGrid,
  calendarDayKey,
  combineDateAndTime,
  extractBookingScheduleSignal,
  formatBookingDateTimeLabel,
  formatBookingMonthLabel,
  isPastCalendarDay,
  isToday,
  shouldShowBookingScheduleButton,
} from "./booking-datetime";

describe("booking datetime helpers", () => {
  it("builds the expected calendar and time slot structure", () => {
    const grid = buildMonthGrid(new Date(2026, 5, 1));

    expect(grid).toHaveLength(6);
    expect(grid[0]).toHaveLength(7);
    expect(BOOKING_TIME_SLOTS[0]?.label).toBe("8:00 AM");
    expect(BOOKING_TIME_SLOTS.at(-1)?.label).toBe("5:30 PM");
  });

  it("combines the selected date and time into a Date", () => {
    const combined = combineDateAndTime(new Date(2026, 5, 24), 14 * 60 + 30);

    expect(combined.getFullYear()).toBe(2026);
    expect(combined.getMonth()).toBe(5);
    expect(combined.getDate()).toBe(24);
    expect(combined.getHours()).toBe(14);
    expect(combined.getMinutes()).toBe(30);
  });

  it("formats the booking confirmation copy", () => {
    const message = buildBookingMessage(new Date(2026, 5, 24, 14, 30));

    expect(message).toContain("Preferred booking date and time:");
    expect(message).toContain("2026");
  });

  it("builds stable local calendar keys and day states", () => {
    const day = new Date(2026, 5, 24);
    const grid = buildMonthGrid(new Date(2026, 5, 1));

    expect(calendarDayKey(day)).toBe("2026-5-24");
    expect(grid.flat().some((cell) => calendarDayKey(cell) === calendarDayKey(day))).toBe(true);
    expect(isToday(new Date())).toBe(true);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(isPastCalendarDay(yesterday)).toBe(true);
    expect(formatBookingMonthLabel(new Date(2026, 5, 1))).toBe("June 2026");
  });

  it("detects when the assistant is asking for the booking schedule", () => {
    expect(shouldShowBookingScheduleButton("What day and time would you prefer for them to reach out?")).toBe(true);
    expect(shouldShowBookingScheduleButton("Please share a preferred date and time for contact.")).toBe(true);
    expect(shouldShowBookingScheduleButton("Thanks, we can review this internally.")).toBe(false);
  });

  it("extracts the structured booking schedule marker from assistant text", () => {
    expect(
      extractBookingScheduleSignal("Please choose a time.\n[[leadpilot.booking_schedule_requested]]"),
    ).toEqual({
      text: "Please choose a time.",
      bookingScheduleRequested: true,
    });
  });
});
