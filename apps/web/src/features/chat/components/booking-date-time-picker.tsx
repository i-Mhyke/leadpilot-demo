import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarBlank, Clock, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  addMonths,
  BOOKING_TIME_SLOTS,
  buildBookingMessage,
  buildMonthGrid,
  calendarDayKey,
  combineDateAndTime,
  formatBookingDateLabel,
  formatBookingDateTimeLabel,
  formatBookingMonthLabel,
  getCalendarWeekdayLabels,
  isFutureSelection,
  isPastCalendarDay,
  isSameDay,
  isSameMonth,
  isToday,
  normalizeMonthStart,
} from "../booking-datetime";

type SelectedBookingDateTime = {
  date: Date;
  timeMinutes: number;
};

function parseInitialValue(value?: string | null): SelectedBookingDateTime | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return {
    date: parsed,
    timeMinutes: parsed.getHours() * 60 + parsed.getMinutes(),
  };
}

export function BookingDateTimePicker(props: {
  initialValue?: string | null;
  className?: string;
  onCancel?: () => void;
  onConfirm: (dateTime: Date) => void;
}) {
  const parsedInitialValue = parseInitialValue(props.initialValue);
  const [viewMonth, setViewMonth] = useState(() => parsedInitialValue?.date ?? new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(parsedInitialValue?.date ?? null);
  const [selectedMinutes, setSelectedMinutes] = useState<number | null>(
    parsedInitialValue?.timeMinutes ?? null,
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    const nextInitialValue = parseInitialValue(props.initialValue);
    setViewMonth(nextInitialValue?.date ?? new Date());
    setSelectedDate(nextInitialValue?.date ?? null);
    setSelectedMinutes(nextInitialValue?.timeMinutes ?? null);
    setValidationError(null);
  }, [props.initialValue]);

  const selectedDateTime =
    selectedDate !== null && selectedMinutes !== null
      ? combineDateAndTime(selectedDate, selectedMinutes)
      : null;

  const isPastSelection = selectedDateTime ? !isFutureSelection(selectedDateTime) : false;
  const canConfirm = Boolean(selectedDateTime) && !isPastSelection;

  function handleConfirm() {
    if (!selectedDateTime) {
      setValidationError("Choose both a date and a time.");
      return;
    }

    if (!isFutureSelection(selectedDateTime)) {
      setValidationError("Choose a future date and time.");
      return;
    }

    setValidationError(null);
    props.onConfirm(selectedDateTime);
  }

  const weekdays = getCalendarWeekdayLabels();
  const monthGrid = buildMonthGrid(viewMonth);

  return (
    <div className={cn("border-border/60 bg-popover text-popover-foreground rounded-[28px] border p-4 shadow-[0_24px_80px_-48px_rgba(28,35,41,0.24)]", props.className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="bg-accent/80 text-accent-foreground inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-medium tracking-[0.14em] uppercase">
            Booking helper
          </div>
          <div className="flex items-center gap-2">
            <CalendarBlank className="text-primary size-4" aria-hidden />
            <h3 id="booking-picker-title" className="text-foreground text-sm font-semibold tracking-tight">
              Pick a date and time
            </h3>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Use a fast, structured booking step before the assistant captures the request.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded-full"
            onClick={() => setViewMonth((current) => addMonths(current, -1))}
            aria-label="Previous month"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Button>
          <div className="bg-muted/60 text-foreground min-w-[9.5rem] rounded-full px-3 py-1 text-center text-xs font-medium tabular-nums">
            {formatBookingMonthLabel(viewMonth)}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded-full"
            onClick={() => setViewMonth((current) => addMonths(current, 1))}
            aria-label="Next month"
          >
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)]">
        <section className="min-w-0 rounded-2xl border border-border/60 bg-background/70 p-3">
          <div className="grid grid-cols-7 gap-1">
            {weekdays.map((weekday) => (
              <div
                key={weekday}
                className="text-muted-foreground flex h-8 items-center justify-center text-[10px] font-medium uppercase tracking-[0.12em]"
              >
                {weekday}
              </div>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {monthGrid.flatMap((week) =>
              week.map((day) => {
                const isInMonth = isSameMonth(day, viewMonth);
                const isSelected = selectedDate !== null && isSameDay(day, selectedDate);
                const isTodayCell = isToday(day);
                const isPastDay = isPastCalendarDay(day);
                const isDisabled = !isInMonth || isPastDay;

                return (
                  <button
                    key={calendarDayKey(day)}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => {
                      setSelectedDate(day);
                      setViewMonth(normalizeMonthStart(day));
                      setValidationError(null);
                    }}
                    className={cn(
                      "flex h-9 min-w-0 items-center justify-center rounded-xl border text-sm font-medium tabular-nums transition-all duration-200",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : isTodayCell
                          ? "border-primary/40 bg-primary/5 text-foreground hover:bg-primary/10"
                          : "border-transparent bg-transparent hover:border-border/70 hover:bg-muted/60",
                      !isInMonth && "text-muted-foreground/35 hover:bg-transparent",
                      isPastDay && "text-muted-foreground/35 hover:bg-transparent",
                      isDisabled ? "cursor-not-allowed opacity-50" : "active:scale-[0.98]",
                    )}
                    aria-pressed={isSelected}
                    aria-disabled={isDisabled}
                    aria-label={formatBookingDateLabel(day)}
                  >
                    {day.getDate()}
                  </button>
                );
              }),
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-background/70 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-foreground text-xs font-medium uppercase tracking-[0.12em]">
                Available times
              </p>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                Choose a slot that matches the preferred booking window.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-full"
              onClick={() => {
                setSelectedDate(new Date());
                setViewMonth(new Date());
                setValidationError(null);
              }}
            >
              Today
            </Button>
          </div>

          <div className="mt-3 grid max-h-64 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-2">
            {BOOKING_TIME_SLOTS.map((slot) => {
              const isSelected = selectedMinutes === slot.minutes;
              return (
                <button
                  key={slot.minutes}
                  type="button"
                  onClick={() => {
                    setSelectedMinutes(slot.minutes);
                    setValidationError(null);
                  }}
                  className={cn(
                    "flex items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition-all duration-200 active:scale-[0.98]",
                    isSelected
                      ? "border-primary/35 bg-primary/10 text-foreground"
                      : "border-border/60 bg-card hover:border-primary/20 hover:bg-muted/50",
                  )}
                  aria-pressed={isSelected}
                >
                  <span className="flex items-center gap-2">
                    <Clock className={cn("size-3.5", isSelected ? "text-primary" : "text-muted-foreground")} aria-hidden />
                    <span>{slot.label}</span>
                  </span>
                  {isSelected ? <span className="bg-primary size-2 rounded-full" aria-hidden /> : null}
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-[0.12em]">
            Selected booking time
          </p>
          <p className="text-foreground mt-1 text-sm font-medium">
            {selectedDateTime ? formatBookingDateTimeLabel(selectedDateTime) : "Choose a date and time"}
          </p>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            {selectedDateTime
              ? buildBookingMessage(selectedDateTime)
              : "The assistant will receive this as the preferred booking time."}
          </p>
          {selectedDateTime && isPastSelection ? (
            <p className="text-destructive mt-1 text-xs leading-relaxed">
              That slot is in the past. Choose a future date and time.
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {props.onCancel ? (
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={props.onCancel}
            >
              <X className="size-4" aria-hidden />
              Cancel
            </Button>
          ) : null}
          <Button
            type="button"
            className="rounded-full px-4"
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            Send time to chat
          </Button>
        </div>
      </div>

      {validationError ? (
        <p className="border-destructive/20 bg-destructive/5 text-destructive mt-3 rounded-2xl border px-3 py-2 text-sm leading-relaxed">
          {validationError}
        </p>
      ) : null}
    </div>
  );
}
