import { WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { ChatPanel } from "./chat-panel";

export function ChatErrorBanner({
  message,
  onRetry,
  onStartNew,
}: {
  message: string;
  onRetry?: () => void;
  onStartNew?: () => void;
}) {
  return (
    <div className="flex justify-start">
      <ChatPanel className="w-full max-w-xl border-destructive/20" innerClassName="px-5 py-4">
        <div className="text-destructive flex items-start gap-2.5">
          <WarningCircle className="mt-0.5 size-4 shrink-0" weight="fill" />
          <div className="min-w-0">
            <p className="text-sm leading-relaxed">{message}</p>
            {onRetry || onStartNew ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {onRetry ? (
                  <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
                    Retry
                  </Button>
                ) : null}
                {onStartNew ? (
                  <Button type="button" variant="outline" size="sm" onClick={onStartNew}>
                    Start new
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </ChatPanel>
    </div>
  );
}
