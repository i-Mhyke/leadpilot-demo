import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { PaperPlaneRight, Stop } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CHAT_MOTION } from "../chat-utils";
import { CHAT_COPY } from "../copy";

export function ChatComposer({
  disabled,
  isStreaming,
  error,
  placeholder,
  onSend,
  onStop,
}: {
  disabled?: boolean;
  isStreaming?: boolean;
  onSend: (message: string) => void;
  onStop?: () => void;
  error?: string;
  placeholder?: string;
}) {
  const [value, setValue] = useState("");
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
    <div className="border-border/60 bg-card shrink-0 border-t px-4 py-4 md:px-8 md:py-5">
      {error ? (
        <div className="border-destructive/20 bg-destructive/5 text-destructive mb-3 rounded-xl border px-3 py-2 text-sm leading-relaxed">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit}>
        <div
          className={cn(
            "rounded-full bg-muted/30 p-1 ring-1 ring-border/40",
            disabled && "opacity-70",
          )}
        >
          <div className="bg-card shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] flex items-end gap-2 rounded-full py-1.5 pr-1.5 pl-4">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder ?? CHAT_COPY.composerPlaceholder}
              disabled={disabled}
              rows={1}
              className="text-foreground placeholder:text-muted-foreground max-h-40 min-h-[2.25rem] min-w-0 flex-1 resize-none border-0 bg-transparent py-2 text-sm leading-relaxed outline-none"
            />

            {isStreaming ? (
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className={cn("size-9 shrink-0 rounded-full", CHAT_MOTION, "active:scale-[0.98]")}
                onClick={onStop}
                aria-label="Stop response"
              >
                <Stop className="size-4" weight="fill" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon"
                className={cn(
                  "bg-primary hover:bg-primary/90 size-9 shrink-0 rounded-full",
                  CHAT_MOTION,
                  "active:scale-[0.98]",
                )}
                disabled={disabled || value.trim().length === 0}
                aria-label="Send message"
              >
                <span className="bg-primary-foreground/15 flex size-full items-center justify-center rounded-full">
                  <PaperPlaneRight className="text-primary-foreground size-4" weight="fill" />
                </span>
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
