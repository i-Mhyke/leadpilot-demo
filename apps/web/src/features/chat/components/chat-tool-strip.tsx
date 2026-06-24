import type { EveDynamicToolPart } from "../use-flue-agent";
import { CheckCircle, MagnifyingGlass, WarningCircle } from "@phosphor-icons/react";
import { CHAT_COPY } from "../copy";

function formatToolName(toolName: string) {
  return toolName.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function isTerminalState(state: string) {
  return (
    state === "output-available" ||
    state === "approval-responded" ||
    state === "output-denied" ||
    state === "output-error"
  );
}

function isErrorState(state: string) {
  return state.includes("error") || state === "output-denied";
}

export { isErrorState };

/** Keep one row per tool name (latest call wins). Drop in-progress once a terminal call exists for that tool. */
export function dedupeToolParts(parts: readonly EveDynamicToolPart[]) {
  const latestByName = new Map<string, EveDynamicToolPart>();

  for (const part of parts) {
    latestByName.set(part.toolName, part);
  }

  const terminalNames = new Set<string>();
  for (const part of latestByName.values()) {
    if (isTerminalState(part.state)) {
      terminalNames.add(part.toolName);
    }
  }

  return Array.from(latestByName.values()).filter((part) => {
    if (!isTerminalState(part.state) && terminalNames.has(part.toolName)) {
      return false;
    }
    return true;
  });
}

export function ChatToolStrip({ parts }: { parts: readonly EveDynamicToolPart[] }) {
  const visible = dedupeToolParts(parts);
  if (visible.length === 0) return null;

  return (
    <div className="mb-1.5 flex flex-wrap gap-1.5 px-1">
      {visible.map((part) => {
        const done = isTerminalState(part.state) && !isErrorState(part.state);
        const failed = isErrorState(part.state);

        return (
          <div
            key={part.toolCallId}
            className="border-border/60 bg-muted/40 text-muted-foreground inline-flex max-w-full items-center gap-1.5 overflow-hidden rounded-full border px-2.5 py-1 text-[11px] font-medium"
          >
            {failed ? (
              <WarningCircle className="size-3 shrink-0 text-destructive" weight="fill" />
            ) : done ? (
              <CheckCircle className="text-primary size-3 shrink-0" weight="fill" />
            ) : (
              <MagnifyingGlass className="size-3 shrink-0 animate-pulse" weight="duotone" />
            )}
            <span>{formatToolName(part.toolName)}</span>
            <span className="text-muted-foreground/50">·</span>
            <span>{done ? CHAT_COPY.toolComplete : failed ? "Failed" : CHAT_COPY.toolRunning}</span>
          </div>
        );
      })}
    </div>
  );
}
