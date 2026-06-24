"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { BookingDateTimePicker } from "./booking-date-time-picker";

export function BookingDateTimeModal({
  open,
  onOpenChange,
  onConfirm,
  initialValue,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (dateTime: Date) => void;
  initialValue?: string | null;
}) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenChange(false);
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onOpenChange]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[#1c2329]/40 backdrop-blur-[2px]"
        aria-label="Close booking picker"
        onClick={() => onOpenChange(false)}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-picker-title"
        className="border-border/60 bg-card relative z-10 flex max-h-[min(92dvh,48rem)] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border shadow-[0_24px_80px_-32px_rgba(28,35,41,0.35)] sm:rounded-2xl"
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
          <BookingDateTimePicker
            initialValue={initialValue}
            className="border-0 bg-transparent shadow-none"
            onCancel={() => onOpenChange(false)}
            onConfirm={onConfirm}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
