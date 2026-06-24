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

  constructor(
    _options: { host: string; headers: () => Record<string, string> },
    initialState?: Partial<SessionState>,
  ) {
    this.host = _options.host;
    this.state = { streamIndex: 0, ...initialState };
  }

  async send<TOutput = unknown>(input: SendTurnInput<TOutput>) {
    const payload = typeof input === "string" ? { message: input } : input;
    // Reuse existing sessionId for context persistence across messages,
    // or generate one on the first call.
    if (!this.state.sessionId) {
      this.state.sessionId = crypto.randomUUID();
    }
    const id = this.state.sessionId;
    const base = this.host || "";
    console.log("[FlueSession] POST to", `${base}/agents/leadpilot/${id}?wait=result`, "sessionId:", id);
    const url = `${base}/agents/leadpilot/${encodeURIComponent(id)}?wait=result`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
      throw new Error(`Agent error (${response.status}): ${text}`);
    }
    const data = await response.json();
    console.log("[FlueSession] POST response:", data);
    return { sessionId: id, offset: data.offset || "-1", result: data.result };
  }

  async *stream(_options?: { signal?: AbortSignal }): AsyncGenerator<FlueStreamEvent> {
    // Streaming not used - using ?wait=result instead
    console.log("[FlueSession] stream() called but using wait=result mode");
    return;
  }
}
