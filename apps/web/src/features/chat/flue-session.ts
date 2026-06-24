export type FlueStreamEvent = { type: string; data?: Record<string, unknown>; turnId?: string };

export interface SessionState {
  streamIndex: number;
  sessionId?: string;
  continuationToken?: string;
  needsReconciliation?: boolean;
}

export type SendTurnPayload<TOutput = unknown> = {
  message?: string;
  inputResponses?: unknown[];
  clientContext?: Record<string, unknown>;
  outputSchema?: unknown;
  signal?: AbortSignal;
  headers?: Readonly<Record<string, string>>;
  output?: TOutput;
};

export type SendTurnInput<TOutput = unknown> = string | SendTurnPayload<TOutput>;

export type StreamOptions = {
  signal?: AbortSignal;
  startIndex?: number;
};

export interface ClientSession {
  state?: SessionState;
  send<TOutput = unknown>(input: SendTurnInput<TOutput>): Promise<{
    sessionId?: string;
    offset?: string;
    result?: unknown;
  }>;
  stream?(options?: StreamOptions): AsyncGenerator<FlueStreamEvent>;
}

export class FlueSession {
  state: SessionState;
  private host: string;
  private getHeaders: () => Record<string, string>;
  private agentInstanceId: string;

  constructor(
    options: {
      host: string;
      headers: () => Record<string, string>;
      firmSlug: string;
      browserSessionId: string;
    },
    initialState?: Partial<SessionState>,
  ) {
    this.host = options.host;
    this.getHeaders = options.headers;
    this.agentInstanceId = `${options.firmSlug}/${options.browserSessionId}`;
    this.state = {
      streamIndex: 0,
      sessionId: initialState?.sessionId ?? this.agentInstanceId,
      ...initialState,
    };
  }

  async send<TOutput = unknown>(input: SendTurnInput<TOutput>) {
    const payload = typeof input === "string" ? { message: input } : input;
    const id = this.agentInstanceId;
    this.state.sessionId = id;
    const base = this.host || "";
    const url = `${base}/agents/leadpilot/${encodeURIComponent(id)}?wait=result`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.getHeaders(),
      },
      body: JSON.stringify(
        payload.inputResponses !== undefined || payload.clientContext !== undefined
          ? {
              message: payload.message,
              inputResponses: payload.inputResponses,
              clientContext: payload.clientContext,
            }
          : { message: payload.message },
      ),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Agent error (${response.status}): ${readErrorMessage(text)}`);
    }
    const data = await response.json();
    return { sessionId: id, offset: data.offset || "-1", result: data.result };
  }

  async *stream(_options?: { signal?: AbortSignal }): AsyncGenerator<FlueStreamEvent> {
    return;
  }
}

function readErrorMessage(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return "unknown error";

  try {
    const payload = JSON.parse(trimmed) as Record<string, unknown>;
    if (typeof payload.message === "string" && payload.message.trim()) return payload.message.trim();
    if (typeof payload.error === "string" && payload.error.trim()) return payload.error.trim();
  } catch {
    // Fall through to the raw body text.
  }

  return trimmed;
}
