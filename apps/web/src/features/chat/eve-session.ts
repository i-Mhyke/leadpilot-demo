import type {
  ClientSession,
  FlueStreamEvent,
  SendTurnInput,
  SendTurnPayload,
  SessionState,
  StreamOptions,
} from "./flue-session";
import { LEADPILOT_CLIENT_CONTEXT_HEADER } from "@/lib/leadpilot-client-context";
import type { DemoSessionCursor } from "./hooks/use-demo-sessions";
import {
  DEFAULT_TURN_RECOVERY_POLICY,
  isTerminalBoundaryEvent,
  type TurnRecoveryResult,
} from "./turn-recovery";
import {
  composeAbortSignals,
  createTurnDeadlineController,
  isTurnGuardrailsEnabled,
  readTurnTimeoutMs,
} from "./turn-deadline";

export type LeadPilotSessionState = SessionState & {
  needsReconciliation?: boolean;
};

export type LeadPilotClientContext = Readonly<Record<string, string>>;

type LeadPilotEveSessionOptions = {
  host: string;
  maxReconnectAttempts?: number;
  preserveCompletedSessions: true;
  headers: () => Readonly<Record<string, string>>;
  turnTimeoutMs?: number;
};

type MessageRouteResponse = {
  continuationToken?: string;
  sessionId?: string;
};

const EVE_CREATE_SESSION_ROUTE_PATH = "/eve/v1/session";
const EVE_SESSION_ID_HEADER = "x-eve-session-id";
const RETRYABLE_STREAM_STATUS = new Set([404, 409, 425, 500, 502, 503, 504]);

export function isReasoningStreamEvent(event: FlueStreamEvent): boolean {
  return String(event.type).includes("reasoning");
}

const EVE_RECONCILE_HOOK = Symbol.for("leadpilot.eve.reconcile");

export function reconcileLeadPilotEveSession(
  session: ClientSession,
): Promise<TurnRecoveryResult> {
  const candidate = session as ClientSession & {
    [EVE_RECONCILE_HOOK]?: () => Promise<TurnRecoveryResult>;
  };
  return candidate[EVE_RECONCILE_HOOK]?.() ?? Promise.resolve({ status: "aborted" });
}

export function readLeadPilotEveSessionState(session: ClientSession): LeadPilotSessionState | undefined {
  return (session as ClientSession & { state?: LeadPilotSessionState }).state;
}

export function createLeadPilotEveSessionOptions({
  getClientContext,
  host,
}: {
  getClientContext: () => LeadPilotClientContext;
  host: string;
}): LeadPilotEveSessionOptions {
  return {
    headers: () => ({
      [LEADPILOT_CLIENT_CONTEXT_HEADER]: JSON.stringify(getClientContext()),
    }),
    host,
    maxReconnectAttempts: 3,
    preserveCompletedSessions: true,
    turnTimeoutMs: isTurnGuardrailsEnabled() ? readTurnTimeoutMs() : undefined,
  };
}

export function createLeadPilotEveSession({
  getClientContext,
  hydratedTurnIds,
  host,
  initialSession,
}: {
  getClientContext: () => LeadPilotClientContext;
  hydratedTurnIds?: Iterable<string>;
  host: string;
  initialSession?: DemoSessionCursor;
}) {
  const browserSession = new BrowserLeadPilotEveSession(
    createLeadPilotEveSessionOptions({ getClientContext, host }),
    initialSession ?? { streamIndex: 0 },
    new Set(hydratedTurnIds),
  );
  const withReconcile = browserSession as unknown as ClientSession & {
    [EVE_RECONCILE_HOOK]: () => Promise<TurnRecoveryResult>;
  };
  withReconcile[EVE_RECONCILE_HOOK] = () => browserSession.reconcilePendingTurn();
  return withReconcile as unknown as ClientSession;
}

class BrowserLeadPilotEveSession {
  #state: LeadPilotSessionState;

  constructor(
    private readonly options: LeadPilotEveSessionOptions,
    initialSession: LeadPilotSessionState,
    private readonly hydratedTurnIds: ReadonlySet<string>,
  ) {
    this.#state = initialSession;
  }

  get state() {
    return this.#state;
  }

  async send<TOutput = unknown>(input: SendTurnInput<TOutput>) {
    const payload = normalizeSendTurnInput(input);
    const previousState = this.#state;
    const { continuationToken, sessionId } = await this.postTurn(payload, previousState);

    const deadline =
      this.options.turnTimeoutMs !== undefined
        ? createTurnDeadlineController(this.options.turnTimeoutMs)
        : undefined;
    const streamPayload: SendTurnPayload = {
      ...payload,
      signal: composeAbortSignals(payload.signal, deadline?.signal),
    };

    return {
      continuationToken,
      sessionId,
      [Symbol.asyncIterator]: () =>
        this.streamTurn({
          continuationToken,
          payload: streamPayload,
          previousState,
          sessionId,
          onFinally: () => deadline?.cleanup(),
        }),
    };
  }

  stream(options?: StreamOptions) {
    const sessionId = this.#state.sessionId;
    if (!sessionId) throw Error("Session has no session ID. Send a message first.");
    return this.streamFromSession(sessionId, {
      signal: options?.signal,
      startIndex: options?.startIndex ?? this.#state.streamIndex,
    });
  }

  async reconcilePendingTurn(): Promise<TurnRecoveryResult> {
    const sessionId = this.#state.sessionId;
    if (!sessionId || !this.#state.needsReconciliation) {
      return { status: "aborted" };
    }

    let attempts = 0;
    while (attempts <= DEFAULT_TURN_RECOVERY_POLICY.maxReconnectAttempts) {
      const events: FlueStreamEvent[] = [];
      const visibleEvents: FlueStreamEvent[] = [];
      const startIndex = this.#state.streamIndex;
      let terminalBoundary: TurnRecoveryResult | null = null;

      try {
        for await (const event of this.streamFromSession(sessionId, { startIndex })) {
          events.push(event);
          if (isReasoningStreamEvent(event)) continue;
          visibleEvents.push(event);
          if (isTerminalBoundaryEvent(event)) {
            terminalBoundary = {
              status: "terminal",
              boundary: event.type as "session.failed" | "session.completed" | "session.waiting",
              recoveredVisibleEvents: visibleEvents,
            };
            break;
          }
        }
      } catch {
        // Retry on transient disconnects during reconciliation.
      }

      this.#state = advanceSession({
        continuationToken: this.#state.continuationToken,
        events,
        visibleEvents,
        previousState: this.#state,
        sessionId,
        startIndex,
      });

      if (terminalBoundary && !this.#state.needsReconciliation) {
        return terminalBoundary;
      }

      attempts += 1;
      if (attempts > DEFAULT_TURN_RECOVERY_POLICY.maxReconnectAttempts) {
        break;
      }
      await sleep(DEFAULT_TURN_RECOVERY_POLICY.retryDelayMs);
    }

    return { status: "exhausted" };
  }

  private async postTurn(
    input: SendTurnPayload,
    session: SessionState,
  ): Promise<{ continuationToken?: string; sessionId: string }> {
    const path = session.sessionId
      ? createContinueSessionRoutePath(session.sessionId)
      : EVE_CREATE_SESSION_ROUTE_PATH;
    const headers = this.resolveHeaders(input.headers);
    headers.set("content-type", "application/json");
    const body = createHandleMessageBody({ input, session });
    if (body === null) {
      throw Error("Session.send requires a non-empty message, inputResponses, or both.");
    }

    const response = await fetch(createClientUrl(this.options.host, path), {
      body: JSON.stringify(body),
      headers,
      method: "POST",
      signal: input.signal ?? null,
    });
    if (!response.ok) {
      throw Error(await response.text());
    }

    const data = (await response.json()) as MessageRouteResponse;
    const sessionId =
      (typeof data.sessionId === "string" ? data.sessionId : undefined) ??
      response.headers.get(EVE_SESSION_ID_HEADER)?.trim() ??
      session.sessionId;
    if (!sessionId) throw Error("Message route did not return a session id.");

    return {
      continuationToken:
        typeof data.continuationToken === "string" ? data.continuationToken : undefined,
      sessionId,
    };
  }

  private async *streamTurn({
    continuationToken,
    payload,
    previousState,
    sessionId,
    onFinally,
  }: {
    continuationToken?: string;
    payload: SendTurnPayload;
    previousState: SessionState;
    sessionId: string;
    onFinally?: () => void;
  }) {
    const startIndex = previousState.sessionId === sessionId ? previousState.streamIndex : 0;
    const events: FlueStreamEvent[] = [];
    const visibleEvents: FlueStreamEvent[] = [];
    const replayFilter = createHydratedTurnReplayFilter(this.hydratedTurnIds);

    try {
      for await (const event of this.streamFromSession(sessionId, {
        headers: payload.headers,
        signal: payload.signal,
        startIndex,
      })) {
        events.push(event);
        if (isReasoningStreamEvent(event)) continue;
        if (!replayFilter(event)) continue;
        visibleEvents.push(event);
        yield event;
        if (isCurrentTurnBoundaryEvent(event)) break;
      }
    } finally {
      onFinally?.();
      this.#state = advanceSession({
        continuationToken,
        events,
        visibleEvents,
        previousState,
        sessionId,
        startIndex,
      });
    }
  }

  private async *streamFromSession(
    sessionId: string,
    options: {
      headers?: Readonly<Record<string, string>>;
      signal?: AbortSignal;
      startIndex: number;
    },
  ) {
    let startIndex = options.startIndex;
    let reconnectsRemaining = this.options.maxReconnectAttempts ?? 3;

    for (;;) {
      let disconnected = false;
      const body = await this.openStreamBody(sessionId, {
        headers: options.headers,
        signal: options.signal,
        startIndex,
      });

      try {
        for await (const event of readNdjsonStream(body)) {
          startIndex += 1;
          yield event;
        }
      } catch (error) {
        if (!isStreamDisconnectError(error)) throw error;
        disconnected = true;
      }

      if (!disconnected || options.signal?.aborted || reconnectsRemaining <= 0) return;
      reconnectsRemaining -= 1;
    }
  }

  private async openStreamBody(
    sessionId: string,
    options: {
      headers?: Readonly<Record<string, string>>;
      signal?: AbortSignal;
      startIndex: number;
    },
  ) {
    let lastStatus = 0;
    let lastBody = "Failed to open message stream.";

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const response = await fetch(
        createClientUrl(
          this.options.host,
          createMessageStreamRoutePath(sessionId),
          options.startIndex > 0 ? { startIndex: String(options.startIndex) } : undefined,
        ),
        {
          headers: this.resolveHeaders(options.headers),
          signal: options.signal ?? null,
        },
      );

      if (response.ok) {
        if (!response.body) throw Error("Response body is null.");
        return response.body;
      }

      lastStatus = response.status;
      lastBody = await response.text();
      if (!RETRYABLE_STREAM_STATUS.has(response.status)) {
        throw Error(lastBody);
      }
      if (attempt < 11) await sleep(250);
    }

    throw Error(`${lastStatus}: ${lastBody}`);
  }

  private resolveHeaders(perRequest?: Readonly<Record<string, string>>) {
    const headers = new Headers(this.options.headers());
    if (perRequest) {
      for (const [key, value] of Object.entries(perRequest)) {
        headers.set(key, value);
      }
    }
    return headers;
  }
}

function normalizeSendTurnInput<TOutput>(input: SendTurnInput<TOutput>): SendTurnPayload<TOutput> {
  return typeof input === "string" ? { message: input } : input;
}

function createHandleMessageBody({
  input,
  session,
}: {
  input: SendTurnPayload;
  session: SessionState;
}) {
  const body: Record<string, unknown> = {};
  if (input.message !== undefined) body.message = input.message;
  if (input.inputResponses !== undefined && input.inputResponses.length > 0) {
    body.inputResponses = input.inputResponses;
  }
  if (input.clientContext !== undefined) body.clientContext = input.clientContext;
  if (input.outputSchema !== undefined) body.outputSchema = input.outputSchema;
  if (session.continuationToken !== undefined) {
    body.continuationToken = session.continuationToken;
  }

  if (Object.keys(body).length === 0) return null;
  if (session.continuationToken === undefined && body.message === undefined) return null;
  if (
    session.continuationToken !== undefined &&
    body.message === undefined &&
    body.inputResponses === undefined
  ) {
    return null;
  }
  return body;
}

export function advanceSession({
  continuationToken,
  events,
  visibleEvents,
  previousState,
  sessionId,
  startIndex,
}: {
  continuationToken?: string;
  events: FlueStreamEvent[];
  visibleEvents: FlueStreamEvent[];
  previousState: SessionState;
  sessionId: string;
  startIndex: number;
}): LeadPilotSessionState & { needsReconciliation?: boolean } {
  const boundaryEvent = findBoundaryEvent(visibleEvents.length > 0 ? visibleEvents : events);
  const streamIndex = startIndex + events.length;

  if (
    boundaryEvent?.type === "session.waiting" ||
    boundaryEvent?.type === "session.completed" ||
    boundaryEvent?.type === "session.failed"
  ) {
    return {
      continuationToken: continuationToken ?? previousState.continuationToken,
      sessionId,
      streamIndex,
      needsReconciliation: false,
    };
  }

  const preservedStreamIndex = Math.max(streamIndex, previousState.streamIndex ?? 0, startIndex);

  return {
    continuationToken: continuationToken ?? previousState.continuationToken,
    sessionId,
    streamIndex: preservedStreamIndex,
    needsReconciliation: Boolean(previousState.sessionId ?? sessionId),
  };
}

export function createHydratedTurnReplayFilter(hydratedTurnIds: ReadonlySet<string>) {
  if (hydratedTurnIds.size === 0) {
    return () => true;
  }

  let acceptedNewTurn = false;

  return (event: FlueStreamEvent) => {
    const turnId = turnIdForStreamEvent(event);
    if (turnId !== undefined) {
      if (!acceptedNewTurn && hydratedTurnIds.has(turnId)) {
        return false;
      }
      acceptedNewTurn = true;
      return true;
    }

    return acceptedNewTurn;
  };
}

export function turnIdForStreamEvent(event: FlueStreamEvent) {
  const data = "data" in event ? event.data : undefined;
  if (data && typeof data === "object" && "turnId" in data && typeof data.turnId === "string") {
    return data.turnId;
  }
}

function findBoundaryEvent(events: FlueStreamEvent[]) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event && isCurrentTurnBoundaryEvent(event)) return event;
  }
}

function isCurrentTurnBoundaryEvent(event: FlueStreamEvent) {
  return (
    event.type === "session.completed" ||
    event.type === "session.failed" ||
    event.type === "session.waiting"
  );
}

async function* readNdjsonStream(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (line) yield JSON.parse(line) as FlueStreamEvent;
        newlineIndex = buffer.indexOf("\n");
      }
    }

    buffer += decoder.decode();
    const finalLine = buffer.trim();
    if (finalLine) yield JSON.parse(finalLine) as FlueStreamEvent;
  } finally {
    reader.releaseLock();
  }
}

function isStreamDisconnectError(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") return false;
  return error instanceof TypeError || error instanceof DOMException;
}

function createClientUrl(
  host: string,
  path: string,
  searchParams?: Record<string, string>,
) {
  const normalizedHost = host.endsWith("/") ? host.slice(0, -1) : host;
  const url = `${normalizedHost}${path}`;
  if (!searchParams) return url;
  const query = new URLSearchParams(searchParams).toString();
  return query ? `${url}?${query}` : url;
}

function createContinueSessionRoutePath(sessionId: string) {
  return `/eve/v1/session/${encodeURIComponent(sessionId)}`;
}

function createMessageStreamRoutePath(sessionId: string) {
  return `/eve/v1/session/${encodeURIComponent(sessionId)}/stream`;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
