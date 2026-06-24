import { useCallback, useEffect, useRef, useState } from "react";
import type { ConversationMetadata } from "@leadpilot/shared";
import { extractBookingScheduleSignal, shouldShowBookingScheduleButton } from "./booking-datetime";
import { FlueSession, type FlueStreamEvent, type SendTurnInput } from "./flue-session";

export type EveTextPart = { type: "text"; text: string };
export type EveToolCallPart = {
  type: "tool-call";
  name: string;
  args?: Record<string, unknown>;
};
export type EveReasoningPart = { type: "reasoning"; text?: string };
export type EveStepStartPart = { type: "step-start"; stepIndex?: number };
export type EveDynamicToolPart = {
  type: "dynamic-tool";
  toolCallId: string;
  toolName: string;
  state: string;
  output?: unknown;
  error?: string;
};
export type EveMessagePart =
  | EveTextPart
  | EveToolCallPart
  | EveReasoningPart
  | EveStepStartPart
  | EveDynamicToolPart;

export type EveMessage = {
  role: "user" | "assistant" | "tool";
  parts: EveMessagePart[];
  metadata?: ConversationMetadata;
};

export type UseEveAgentStatus = "idle" | "submitted" | "streaming" | "error" | "done";

export type EveMessageData = { message: string };
const BOOKING_SCHEDULE_FALLBACK_TEXT = "What day and time would you prefer?";

export interface UseEveAgentOptions<TMessageData = EveMessageData> {
  session: FlueSession;
  initialEvents?: FlueStreamEvent[];
  onEvent?: (event: FlueStreamEvent) => void;
  onSessionChange?: (cursor: { streamIndex: number; sessionId?: string }) => void;
  onFinish?: (snapshot: {
    data: { messages: EveMessage[] };
    session: { streamIndex: number; sessionId?: string };
  }) => void;
  messageData?: TMessageData;
}

export function useFlueAgent(options: {
  session: FlueSession;
  initialEvents?: FlueStreamEvent[];
  onEvent?: (event: FlueStreamEvent) => void;
  onSessionChange?: (cursor: { streamIndex: number; sessionId?: string }) => void;
  onFinish?: (snapshot: { data: { messages: EveMessage[] }; session: { streamIndex: number; sessionId?: string } }) => void;
}) {
  const [status, setStatus] = useState<UseEveAgentStatus>("idle");
  const [messages, setMessages] = useState<EveMessage[]>([]);
  const [events, setEvents] = useState<FlueStreamEvent[]>([]);
  const [error, setError] = useState<{ message: string } | null>(null);
  const aborterRef = useRef<AbortController | null>(null);
  const sessionRef = useRef(options.session);
  const onSessionChangeRef = useRef(options.onSessionChange);
  const onFinishRef = useRef(options.onFinish);
  const lastUserMsgRef = useRef<string>("");
  sessionRef.current = options.session;
  onSessionChangeRef.current = options.onSessionChange;
  onFinishRef.current = options.onFinish;

  useEffect(() => {
    const initialEvents = options.initialEvents ?? [];
    setEvents(initialEvents);
    setMessages(parseInitialEvents(initialEvents));
  }, [options.initialEvents]);

  const stop = useCallback(() => {
    aborterRef.current?.abort();
    setStatus("idle");
  }, []);

  const send = useCallback(async (input: SendTurnInput) => {
    if (status === "submitted" || status === "streaming") return;
    const message = typeof input === "string" ? input : input.message ?? "";
    setError(null);
    setStatus("submitted");

    lastUserMsgRef.current = message;
    const userMsg: EveMessage = { role: "user", parts: [{ type: "text", text: message }] };
    setMessages(prev => [...prev, userMsg]);

    const aborter = new AbortController();
    aborterRef.current = aborter;

    try {
      const result = await sessionRef.current.send(input);
      const responsePayload = unwrapAssistantResponse(result);
      const rawResponseText = responsePayload.text ?? "";
      const extractedSignal = extractBookingScheduleSignal(rawResponseText);
      const bookingScheduleRequested =
        responsePayload.ui?.bookingScheduleRequested ??
        extractedSignal.bookingScheduleRequested ??
        shouldShowBookingScheduleButton(extractedSignal.text);
      const responseText =
        extractedSignal.text.trim().length > 0
          ? extractedSignal.text
          : bookingScheduleRequested
            ? BOOKING_SCHEDULE_FALLBACK_TEXT
            : "";
      const assistantMsg: EveMessage = {
        role: "assistant",
        parts: [{ type: "text", text: responseText }],
        metadata: bookingScheduleRequested
          ? { ui: { bookingScheduleRequested: true } }
          : undefined,
      };
      if (responseText || bookingScheduleRequested) {
        setMessages(prev => [...prev, assistantMsg]);
      }
      setStatus("done");
      onSessionChangeRef.current?.({
        streamIndex: sessionRef.current.state.streamIndex,
        sessionId: sessionRef.current.state.sessionId,
      });
      // Pass both user + assistant messages in onFinish
      onFinishRef.current?.({
        data: { messages: [userMsg, assistantMsg] },
        session: { streamIndex: sessionRef.current.state.streamIndex, sessionId: sessionRef.current.state.sessionId },
      });
      return { sessionId: sessionRef.current.state.sessionId };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError({ message: msg });
      setStatus("error");
      onSessionChangeRef.current?.({
        streamIndex: sessionRef.current.state.streamIndex,
        sessionId: sessionRef.current.state.sessionId,
      });
      return { sessionId: sessionRef.current.state.sessionId };
    }
  }, [status]);

  return { status, data: { messages }, events, error, send, stop };
}

function parseInitialEvents(events: FlueStreamEvent[]): EveMessage[] {
  const msgs: EveMessage[] = [];
  for (const evt of events) {
    if (!isHydratedMessageEvent(evt)) continue;
    const message = normalizeHydratedMessage(evt);
    if (!message) continue;
    msgs.push(message);
  }
  return msgs;
}

function isHydratedMessageEvent(evt: FlueStreamEvent) {
  return evt.type === "message_end" || evt.type === "message.completed" || evt.type === "message.received";
}

function normalizeHydratedMessage(evt: FlueStreamEvent): EveMessage | undefined {
  const rawMessage = evt.data?.message;
  const message = normalizeHydratedMessagePayload(rawMessage);
  if (!message) return undefined;

  const role = evt.type === "message.received" ? "user" : message.role;
  const normalizedText =
    role === "assistant" ? extractBookingScheduleSignal(message.text) : { text: message.text, bookingScheduleRequested: false };
  const metadata = normalizedText.bookingScheduleRequested
    ? {
        ...(message.metadata ?? {}),
        ui: { ...(message.metadata?.ui ?? {}), bookingScheduleRequested: true },
      }
    : message.metadata;
  const text =
    normalizedText.text.trim().length > 0
      ? normalizedText.text
      : metadata?.ui?.bookingScheduleRequested
        ? BOOKING_SCHEDULE_FALLBACK_TEXT
        : "";
  if (!text && !metadata?.ui?.bookingScheduleRequested) return undefined;

  return {
    role,
    parts: text ? [{ type: "text", text }] : [],
    metadata,
  };
}

function normalizeHydratedMessagePayload(
  message: unknown,
): { role: "user" | "assistant"; text: string; metadata?: ConversationMetadata } | undefined {
  if (typeof message === "string") {
    return { role: "assistant", text: message };
  }
  if (!message || typeof message !== "object" || Array.isArray(message)) return undefined;

  const record = message as Record<string, unknown>;
  const text = typeof record.text === "string" ? record.text : typeof record.message === "string" ? record.message : "";
  const role = record.role === "user" ? "user" : "assistant";
  const metadata =
    record.metadata && typeof record.metadata === "object" && !Array.isArray(record.metadata)
      ? (record.metadata as ConversationMetadata)
      : undefined;

  return { role, text, metadata };
}

function unwrapAssistantResponse(result: unknown): {
  text?: string;
  ui?: { bookingScheduleRequested?: boolean };
} {
  const candidate = unwrapResultPayload(result);
  if (typeof candidate === "string") {
    return { text: candidate };
  }
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return {};
  }

  const record = candidate as Record<string, unknown>;
  const text =
    typeof record.text === "string"
      ? record.text
      : typeof record.message === "string"
        ? record.message
        : undefined;
  const ui =
    record.ui && typeof record.ui === "object" && !Array.isArray(record.ui)
      ? (record.ui as Record<string, unknown>)
      : undefined;

  return {
    text,
    ui: typeof ui?.bookingScheduleRequested === "boolean" ? { bookingScheduleRequested: ui.bookingScheduleRequested } : undefined,
  };
}

function unwrapResultPayload(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  if ("result" in record) return unwrapResultPayload(record.result);
  if ("data" in record) return unwrapResultPayload(record.data);
  return value;
}
