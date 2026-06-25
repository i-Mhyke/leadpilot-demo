const BOOKING_LOCALE = "en-US";
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const BOOKING_SCHEDULE_SIGNAL = "[[leadpilot.booking_schedule_requested]]";

export const BOOKING_TIME_SLOTS = Array.from({ length: 20 }, (_, index) => {
  const minutes = 8 * 60 + index * 30;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return {
    minutes,
    label: `${formatClockLabel(hours, remainder)}`,
  };
});

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatClockLabel(hours: number, minutes: number) {
  const period = hours >= 12 ? "PM" : "AM";
  const normalizedHours = hours % 12 || 12;
  return `${normalizedHours}:${pad(minutes)} ${period}`;
}

export function formatBookingDateLabel(date: Date) {
  return new Intl.DateTimeFormat(BOOKING_LOCALE, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatBookingDateTimeLabel(date: Date) {
  return new Intl.DateTimeFormat(BOOKING_LOCALE, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatBookingMonthLabel(date: Date) {
  return new Intl.DateTimeFormat(BOOKING_LOCALE, {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function calendarDayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function startOfDay(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

export function buildBookingMessage(date: Date) {
  return `Preferred booking date and time: ${formatBookingDateTimeLabel(date)}.`;
}

export function extractBookingScheduleSignal(message: string) {
  const bookingScheduleRequested = message.includes(BOOKING_SCHEDULE_SIGNAL);
  if (!bookingScheduleRequested) {
    return { text: message, bookingScheduleRequested: false };
  }

  return {
    text: message.replaceAll(BOOKING_SCHEDULE_SIGNAL, "").replace(/\n{3,}/g, "\n\n").trim(),
    bookingScheduleRequested: true,
  };
}

export function shouldShowBookingScheduleButton(message: string) {
  const normalized = message.trim().replace(/\s+/g, " ");
  if (!normalized) return false;
  if (normalized.includes(BOOKING_SCHEDULE_SIGNAL)) return true;

  return [
    /what\s+(?:day|date)\s+and\s+time\s+would\s+you\s+prefer/i,
    /what\s+time\s+(?:on\s+.+\s+)?would\s+you\s+prefer/i,
    /what\s+(?:day|date|time)\s+would\s+you\s+prefer/i,
    /when\s+would\s+you\s+prefer/i,
    /what\s+time\s+works\s+best/i,
    /choose\s+a\s+booking\s+schedule/i,
    /select\s+a\s+booking\s+schedule/i,
    /pick\s+a\s+date\s+and\s+time/i,
    /preferred\s+date\s+and\s+time/i,
    /preferred\s+date\s+and\s+time\s+for\s+contact/i,
    /preferred\s+time\s+for\s+contact/i,
    /please\s+share\s+a\s+preferred\s+date\s+and\s+time/i,
  ].some((pattern) => pattern.test(normalized));
}

export function getCalendarWeekdayLabels() {
  return WEEKDAY_LABELS;
}

export function normalizeMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date: Date, offset: number) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

export function buildMonthGrid(viewMonth: Date) {
  const monthStart = normalizeMonthStart(viewMonth);
  const firstWeekday = (monthStart.getDay() + 6) % 7;
  const gridStart = new Date(monthStart);
  gridStart.setDate(1 - firstWeekday);

  return Array.from({ length: 6 }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex) => {
      const cell = new Date(gridStart);
      cell.setDate(gridStart.getDate() + weekIndex * 7 + dayIndex);
      cell.setHours(0, 0, 0, 0);
      return cell;
    }),
  );
}

export function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function isToday(date: Date) {
  return isSameDay(date, new Date());
}

export function isPastCalendarDay(date: Date) {
  return startOfDay(date).getTime() < startOfDay(new Date()).getTime();
}

export function isSameMonth(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

export function combineDateAndTime(date: Date, minutes: number) {
  const combined = new Date(date);
  combined.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return combined;
}

export function isFutureSelection(date: Date) {
  return date.getTime() > Date.now();
}
