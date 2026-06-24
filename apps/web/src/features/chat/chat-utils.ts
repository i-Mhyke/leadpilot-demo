import type { EveMessage, EveMessagePart } from "./use-flue-agent";
import { stripRawProviderThinkingFallback } from "@leadpilot/shared";
import { extractBookingScheduleSignal } from "./booking-datetime";

export const CHAT_MOTION =
  "transition-[color,background-color,border-color,transform,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]";

const TEMPORARY_ASSISTANT_ERROR =
  "The assistant hit a temporary model issue. Send your message again to retry.";
const CONNECTION_ERROR =
  "Could not reach the assistant. Make sure the agent is running, then send your message again.";

function collectVisibleText(parts: readonly EveMessagePart[]) {
  return parts
    .filter((part) => part.type !== "reasoning" && part.type !== "step-start")
    .filter((part) => part.type === "text")
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("\n\n")
    .trim();
}

export function assistantMessageText(message: EveMessage) {
  if (message.role !== "assistant") return "";
  const visibleText = stripRawProviderThinkingFallback(collectVisibleText(message.parts));
  return extractBookingScheduleSignal(visibleText).text;
}

export function messageHasFailedTool(message: EveMessage) {
  return message.parts.some(
    (part) =>
      part.type === "dynamic-tool" &&
      (part.state.includes("error") || part.state === "output-denied"),
  );
}

export function chatErrorMessageForVisitor(error: string | null | undefined) {
  if (!error?.trim()) return undefined;

  if (/turn deadline exceeded|timed out awaiting reconciliation/i.test(error)) {
    return "That reply took longer than expected. LeadPilot is recovering this conversation before you send another message.";
  }

  if (/failed to fetch|network|connection|econnrefused|load failed/i.test(error)) {
    return CONNECTION_ERROR;
  }

  if (
    /server_error|internal_server_error|model call failed|tool-loop stream error|request id|req_[a-z0-9]+/i.test(
      error,
    )
  ) {
    return TEMPORARY_ASSISTANT_ERROR;
  }

  return "The assistant hit a problem and could not finish that reply. Send your message again to continue.";
}

export function shouldPreserveSessionCursorOnError(error: string | null | undefined) {
  const visitorMessage = chatErrorMessageForVisitor(error);
  return /recovering this conversation/i.test(visitorMessage ?? "");
}

export function shouldShowChatPerfOverlay(env: {
  DEV?: boolean;
  VITE_CHAT_PERF_OVERLAY?: string;
}) {
  return env.DEV === true && env.VITE_CHAT_PERF_OVERLAY === "true";
}

export function chatThreadAgentKey({
  sessionId,
  runtimeResetKey,
}: {
  sessionId: string;
  runtimeResetKey?: number;
  hydrationSessionId?: string;
}) {
  return `${sessionId}:${runtimeResetKey ?? 0}`;
}

export function chatInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function formatChatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function chatEnterClass(index = 0) {
  const delay = Math.min(index, 6) * 40;
  return `dashboard-enter opacity-0 [animation-delay:${delay}ms]`;
}
