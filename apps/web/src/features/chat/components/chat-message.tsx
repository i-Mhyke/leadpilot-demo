import type { EveMessage, EveMessagePart } from "../use-flue-agent";
import { stripRawProviderThinkingFallback } from "@leadpilot/shared";
import { cn } from "@/lib/utils";
import { ChatMarkdown } from "./chat-markdown";
import { ChatPanel } from "./chat-panel";
import { ChatToolStrip, dedupeToolParts, isTerminalState } from "./chat-tool-strip";

function collectText(parts: readonly EveMessagePart[]) {
  return parts
    .filter((part) => part.type === "text")
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("\n\n")
    .trim();
}

export function ChatMessage({
  message,
  isStreaming,
  hideToolsWhilePending = false,
}: {
  message: EveMessage;
  isStreaming?: boolean;
  hideToolsWhilePending?: boolean;
}) {
  const isUser = message.role === "user";
  const visibleParts = message.parts.filter((part) => part.type !== "reasoning" && part.type !== "step-start");
  const textContent = stripRawProviderThinkingFallback(collectText(visibleParts));
  const toolParts = visibleParts.filter((part) => part.type === "dynamic-tool");
  const hasActiveTools = dedupeToolParts(toolParts).some((part) => !isTerminalState(part.state));
  const showToolStrip =
    !hideToolsWhilePending && toolParts.length > 0 && (hasActiveTools || !textContent || isStreaming);

  if (!isUser && !textContent && toolParts.length === 0) {
    return null;
  }

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="bg-primary text-primary-foreground max-w-[min(85%,36rem)] rounded-2xl rounded-br-md px-4 py-3 text-sm leading-relaxed shadow-[0_12px_32px_-20px_rgba(45,106,106,0.45)]">
          <p className="whitespace-pre-wrap">{textContent}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="w-full max-w-[min(92%,48rem)]">
        {showToolStrip ? <ChatToolStrip parts={toolParts} /> : null}

        {textContent ? (
          <ChatPanel
            className={cn(isStreaming && "ring-primary/20")}
            innerClassName={cn("px-5 py-4", isStreaming && "ring-1 ring-primary/15")}
          >
            <ChatMarkdown content={textContent} />
            {isStreaming ? (
              <span className="bg-primary/70 mt-2 inline-block h-4 w-0.5 animate-pulse align-middle" />
            ) : null}
          </ChatPanel>
        ) : null}
      </div>
    </div>
  );
}
