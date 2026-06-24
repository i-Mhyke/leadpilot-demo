import { useCallback, useEffect, useRef, useState } from "react";
import { shouldShowBookingScheduleButton } from "./booking-datetime";
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
  metadata?: Record<string, unknown>;
};

export type UseEveAgentStatus = "idle" | "submitted" | "streaming" | "error" | "done";

export type EveMessageData = { message: string };

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
    if (options.initialEvents && options.initialEvents.length > 0) {
      setEvents(options.initialEvents);
      setMessages(parseInitialEvents(options.initialEvents));
    }
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
      const responseText =
        (result as any)?.result?.text ||
        (result as any)?.text ||
        "";
      const assistantMsg: EveMessage = {
        role: "assistant",
        parts: [{ type: "text", text: responseText }],
        metadata: shouldShowBookingScheduleButton(responseText)
          ? { ui: { bookingScheduleRequested: true } }
          : undefined,
      };
      if (responseText) {
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
    if (evt.type === "message_end" && evt.data?.message) {
      const msg = evt.data.message as Record<string, unknown>;
      const role = (msg.role as string) || "assistant";
      const text = (msg.text as string) || "";
      if (text) {
        msgs.push({ role: role as "user" | "assistant", parts: [{ type: "text", text }] });
      }
    }
  }
  return msgs;
}
