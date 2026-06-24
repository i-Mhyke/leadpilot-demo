import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { CalendarBlank, PaperPlaneRight, Stop } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CHAT_MOTION } from "../chat-utils";
import { CHAT_COPY } from "../copy";
import { buildBookingMessage } from "../booking-datetime";
import { BookingDateTimeModal } from "./booking-date-time-modal";

export function ChatComposer({
  disabled,
  isStreaming,
  error,
  placeholder,
  bookingScheduleRequested,
  onSend,
  onBookingConfirm,
  onStop,
}: {
  disabled?: boolean;
  isStreaming?: boolean;
  bookingScheduleRequested?: boolean;
  onSend: (message: string) => void;
  onBookingConfirm?: (dateTime: Date) => void;
  onStop?: () => void;
  error?: string;
  placeholder?: string;
}) {
  const [value, setValue] = useState("");
  const [showBookingPicker, setShowBookingPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const message = value.trim();
    if (!message || disabled) return;
    onSend(message);
    setValue("");
    textareaRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  };

  return (
    <div className="w-full">
      {error ? (
        <div className="border-destructive/20 bg-destructive/5 text-destructive mb-3 rounded-xl border px-3 py-2 text-sm leading-relaxed">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit}>
        <div
          className={cn(
            "border-border/60 bg-background flex items-end gap-2 rounded-2xl border px-3 py-2 shadow-[0_8px_24px_-20px_rgba(28,35,41,0.22)]",
            disabled && "opacity-70",
          )}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder ?? CHAT_COPY.composerPlaceholder}
            disabled={disabled}
            rows={1}
            className="text-foreground placeholder:text-muted-foreground max-h-36 min-h-[2.5rem] min-w-0 flex-1 resize-none border-0 bg-transparent py-2 text-sm leading-relaxed outline-none"
          />

          <div className="flex shrink-0 items-center gap-1.5 pb-0.5">
            <Button
              type="button"
              size={bookingScheduleRequested ? "sm" : "icon-sm"}
              variant={bookingScheduleRequested ? "secondary" : "ghost"}
              className={cn(
                bookingScheduleRequested
                  ? "border-border/70 bg-muted/70 text-foreground hover:bg-muted/90 whitespace-nowrap rounded-full border px-3.5"
                  : "text-muted-foreground rounded-full",
                CHAT_MOTION,
                "active:scale-[0.98]",
              )}
              onClick={() => setShowBookingPicker(true)}
              disabled={disabled}
              aria-label={bookingScheduleRequested ? "Select Booking Schedule" : "Choose booking date and time"}
            >
              <CalendarBlank className="size-4" />
              {bookingScheduleRequested ? <span className="text-sm font-medium">Select Booking Schedule</span> : null}
            </Button>

            {isStreaming ? (
              <Button
                type="button"
                size="icon-sm"
                variant="secondary"
                className={cn("rounded-full", CHAT_MOTION, "active:scale-[0.98]")}
                onClick={onStop}
                aria-label="Stop response"
              >
                <Stop className="size-4" weight="fill" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon-sm"
                className={cn("bg-primary hover:bg-primary/90 rounded-full", CHAT_MOTION, "active:scale-[0.98]")}
                disabled={disabled || value.trim().length === 0}
                aria-label="Send message"
              >
                <PaperPlaneRight className="text-primary-foreground size-4" weight="fill" />
              </Button>
            )}
          </div>
        </div>
      </form>

      <BookingDateTimeModal
        open={showBookingPicker}
        onOpenChange={setShowBookingPicker}
        onConfirm={(dateTime) => {
          setShowBookingPicker(false);
          if (onBookingConfirm) {
            onBookingConfirm(dateTime);
            return;
          }
          onSend(buildBookingMessage(dateTime));
        }}
      />
    </div>
  );
}
