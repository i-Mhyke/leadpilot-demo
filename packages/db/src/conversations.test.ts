import { describe, expect, it, vi, beforeEach } from "vitest";
import { setSqlForTests } from "./client.ts";
import {
  clearConversationCursorByBrowserSession,
  deleteConversationByBrowserSession,
  findOrCreateConversation,
  findOrCreateVisitor,
  getChatHistoryByBrowserSession,
  resolveConversationContext,
  persistAssistantMessage,
  persistVisitorMessage,
  updateConversationCursorByBrowserSession,
  markConversationFailedByEveSession,
} from "./conversations.ts";

describe("conversation persistence", () => {
  beforeEach(() => {
    setSqlForTests(null);
  });

  it("scopes visitor lookup by firm_id and anonymous_key", async () => {
    const sql = vi.fn().mockResolvedValue([
      {
        id: "visitor-1",
        firm_id: "firm-a",
        anonymous_key: "browser-1",
        name: null,
        email: null,
        phone: null,
        company_name: null,
        source: "web",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ]);
    setSqlForTests(sql as never);

    const visitor = await findOrCreateVisitor({
      firmId: "firm-a",
      anonymousKey: "browser-1",
    });

    expect(visitor.firmId).toBe("firm-a");
    expect(visitor.anonymousKey).toBe("browser-1");
  });

  it("ignores duplicate visitor messages for the same Eve turn", async () => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(undefined);
    setSqlForTests(sql as never);

    const result = await persistVisitorMessage({
      conversationId: "conv-a",
      firmId: "firm-a",
      content: "Hey",
      eveTurnId: "turn-1:user",
    });

    expect(result).toBeNull();
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it("persists a new visitor message when the Eve turn is unseen", async () => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([{ id: "msg-1", created_at: "2026-01-01T00:00:00.000Z" }])
      .mockResolvedValueOnce(undefined);
    setSqlForTests(sql as never);

    const result = await persistVisitorMessage({
      conversationId: "conv-a",
      firmId: "firm-a",
      content: "Hey",
      eveTurnId: "turn-1:user",
    });

    expect(result).toMatchObject({
      id: "msg-1",
      role: "visitor",
      content: "Hey",
      eveTurnId: "turn-1:user",
    });
    expect(sql).toHaveBeenCalledTimes(2);
  });

  it("persists assistant metadata alongside the assistant turn", async () => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([{ id: "msg-2", created_at: "2026-01-01T00:00:00.000Z" }])
      .mockResolvedValueOnce(undefined);
    setSqlForTests(sql as never);

    const result = await persistAssistantMessage({
      conversationId: "conv-a",
      firmId: "firm-a",
      content: "What day and time would you prefer?",
      eveTurnId: "turn-1",
      metadata: {
        ui: { bookingScheduleRequested: true },
      },
    });

    expect(result).toMatchObject({
      id: "msg-2",
      metadata: {
        finishReason: null,
        ui: {
          bookingScheduleRequested: true,
        },
      },
    });
    expect(JSON.parse(String(sql.mock.calls[0]?.[5]))).toMatchObject({
      finishReason: null,
      ui: {
        bookingScheduleRequested: true,
      },
    });
  });

  it("clears stale continuation token when a browser conversation gets a new Eve session", async () => {
    const resumedConversation = {
      id: "conv-a",
      firm_id: "firm-a",
      visitor_id: "visitor-a",
      eve_session_id: "eve-old",
      eve_continuation_token: "token-old",
      eve_stream_index: 7,
      status: "open",
      phase: "listen",
      source_url: "http://localhost/ask/demo-law",
      firm_slug: "demo-law",
      matter_summary: null,
      primary_service_id: null,
      last_message_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const updatedConversation = {
      ...resumedConversation,
      eve_session_id: "eve-new",
      eve_continuation_token: null,
      eve_stream_index: 0,
    };
    const sql = vi
      .fn()
      .mockResolvedValueOnce([resumedConversation])
      .mockResolvedValueOnce([updatedConversation]);
    setSqlForTests(sql as never);

    const result = await findOrCreateConversation({
      firmId: "firm-a",
      firmSlug: "demo-law",
      visitorId: "visitor-a",
      browserSessionId: "browser-1",
      eveSessionId: "eve-new",
      sourceUrl: "http://localhost/ask/demo-law",
    });

    expect(result.eveSessionId).toBe("eve-new");
    expect(result.eveContinuationToken).toBeUndefined();
    expect(result.eveStreamIndex).toBe(0);
    expect(String(sql.mock.calls[1]?.[0])).toContain("eve_continuation_token = NULL");
    expect(String(sql.mock.calls[1]?.[0])).toContain("eve_stream_index = 0");
  });

  it("ignores non-uuid localConversationId values", async () => {
    const conversation = {
      id: "conv-browser",
      firm_id: "firm-a",
      visitor_id: "visitor-a",
      eve_session_id: null,
      eve_continuation_token: null,
      eve_stream_index: 0,
      status: "open",
      phase: "listen",
      source_url: null,
      firm_slug: "demo-law",
      matter_summary: null,
      primary_service_id: null,
      last_message_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const sql = vi.fn().mockResolvedValueOnce([conversation]);
    setSqlForTests(sql as never);

    const result = await findOrCreateConversation({
      firmId: "firm-a",
      firmSlug: "demo-law",
      visitorId: "visitor-a",
      browserSessionId: "dev-terminal",
      localConversationId: "dev-terminal",
    });

    expect(result.id).toBe("conv-browser");
    expect(String(sql.mock.calls[0]?.[0])).toContain("v.anonymous_key");
    expect(String(sql.mock.calls[0]?.[0])).not.toContain("WHERE id =");
  });

  it("uses localConversationId before browser session when resolving conversations", async () => {
    const conversation = {
      id: "11111111-1111-4111-8111-111111111111",
      firm_id: "firm-a",
      visitor_id: "visitor-a",
      eve_session_id: "eve-1",
      eve_continuation_token: "tok-1",
      eve_stream_index: 8,
      status: "open",
      phase: "listen",
      source_url: "http://localhost/ask/demo-law",
      firm_slug: "demo-law",
      matter_summary: null,
      primary_service_id: null,
      last_message_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const sql = vi.fn().mockResolvedValueOnce([conversation]);
    setSqlForTests(sql as never);

    const result = await findOrCreateConversation({
      firmId: "firm-a",
      firmSlug: "demo-law",
      visitorId: "visitor-a",
      browserSessionId: "browser-1",
      localConversationId: "11111111-1111-4111-8111-111111111111",
      eveSessionId: "eve-1",
    });

    expect(result.id).toBe("11111111-1111-4111-8111-111111111111");
    expect(result.eveStreamIndex).toBe(8);
    expect(String(sql.mock.calls[0]?.[0])).toContain("WHERE id =");
    expect(String(sql.mock.calls[0]?.[0])).not.toContain("v.anonymous_key");
  });

  it("hydrates exact conversation history with full Eve cursor", async () => {
    const conversation = {
      id: "conv-a",
      firm_id: "firm-a",
      visitor_id: "visitor-a",
      eve_session_id: "eve-1",
      eve_continuation_token: "tok-1",
      eve_stream_index: 9,
      status: "open",
      phase: "listen",
      source_url: "http://localhost/ask/demo-law",
      firm_slug: "demo-law",
      matter_summary: null,
      primary_service_id: null,
      last_message_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const sql = vi
      .fn()
      .mockResolvedValueOnce([{ id: "firm-a" }])
      .mockResolvedValueOnce([conversation])
      .mockResolvedValueOnce([]);
    setSqlForTests(sql as never);

    const history = await getChatHistoryByBrowserSession({
      firmSlug: "demo-law",
      browserSessionId: "browser-1",
      conversationId: "conv-a",
    });

    expect(history).toMatchObject({
      found: true,
      conversationId: "conv-a",
      sessionCursor: {
        sessionId: "eve-1",
        continuationToken: "tok-1",
        streamIndex: 9,
      },
    });
    expect(String(sql.mock.calls[1]?.[0])).toContain("c.id =");
  });

  it("returns assistant message metadata in chat history", async () => {
    const conversation = {
      id: "conv-a",
      firm_id: "firm-a",
      visitor_id: "visitor-a",
      eve_session_id: "eve-1",
      eve_continuation_token: "tok-1",
      eve_stream_index: 9,
      status: "open",
      phase: "listen",
      source_url: "http://localhost/ask/demo-law",
      firm_slug: "demo-law",
      matter_summary: null,
      primary_service_id: null,
      last_message_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const sql = vi
      .fn()
      .mockResolvedValueOnce([{ id: "firm-a" }])
      .mockResolvedValueOnce([conversation])
      .mockResolvedValueOnce([
        {
          id: "msg-1",
          conversation_id: "conv-a",
          firm_id: "firm-a",
          role: "assistant",
          content: "What day and time would you prefer?",
          eve_turn_id: "turn-1",
          metadata: {
            ui: {
              bookingScheduleRequested: true,
            },
          },
          created_at: "2026-01-01T00:00:01.000Z",
        },
      ]);
    setSqlForTests(sql as never);

    const history = await getChatHistoryByBrowserSession({
      firmSlug: "demo-law",
      browserSessionId: "browser-1",
      conversationId: "conv-a",
    });

    expect(history.messages[0]).toMatchObject({
      metadata: {
        ui: {
          bookingScheduleRequested: true,
        },
      },
    });
  });

  it("persists full Eve cursor by exact conversation id when present", async () => {
    const sql = vi.fn().mockResolvedValueOnce([{ id: "conv-a" }]);
    setSqlForTests(sql as never);

    await updateConversationCursorByBrowserSession({
      firmSlug: "demo-law",
      browserSessionId: "browser-1",
      conversationId: "conv-a",
      sessionCursor: {
        sessionId: "eve-1",
        continuationToken: "tok-1",
        streamIndex: 11,
      },
    });

    const query = String(sql.mock.calls[0]?.[0]);
    expect(query).toContain("eve_session_id =");
    expect(query).toContain("eve_continuation_token =");
    expect(query).toContain("eve_stream_index =");
    expect(query).toContain("WHERE c.id =");
    expect(query).not.toContain("anonymous_key");
  });

  it("clears persisted Eve cursor so stale reloads cannot revive failed sessions", async () => {
    const sql = vi.fn().mockResolvedValueOnce(undefined);
    setSqlForTests(sql as never);

    await clearConversationCursorByBrowserSession({
      firmSlug: "demo-law",
      browserSessionId: "browser-1",
      conversationId: "conv-a",
    });

    const query = String(sql.mock.calls[0]?.[0]);
    expect(query).toContain("eve_session_id = NULL");
    expect(query).toContain("eve_continuation_token = NULL");
    expect(query).toContain("eve_stream_index = 0");
    expect(query).toContain("WHERE c.id =");
  });

  it("deletes the open conversation for a firm browser session", async () => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([{ id: "firm-a" }])
      .mockResolvedValueOnce([{ id: "conv-a" }]);
    setSqlForTests(sql as never);

    const result = await deleteConversationByBrowserSession({
      firmSlug: "demo-law",
      browserSessionId: "browser-1",
    });

    expect(result).toEqual({ deleted: true, conversationId: "conv-a" });
    expect(String(sql.mock.calls[1]?.[0])).toContain("DELETE FROM conversations");
    expect(String(sql.mock.calls[1]?.[0])).toContain("v.anonymous_key =");
    expect(String(sql.mock.calls[1]?.[0])).toContain("c.status = 'open'");
  });

  it("marks an open conversation failed by Eve session id after agent restart", async () => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([{ id: "conv-a", firm_id: "firm-a" }])
      .mockResolvedValueOnce([{ id: "conv-a" }])
      .mockResolvedValueOnce([{ id: "event-1", created_at: "2026-01-01T00:00:00.000Z" }]);
    setSqlForTests(sql as never);

    const marked = await markConversationFailedByEveSession({
      eveSessionId: "eve-1",
      reason: "workflow failed",
    });

    expect(marked).toBe(true);
    expect(String(sql.mock.calls[0]?.[0])).toContain("WHERE eve_session_id =");
    expect(String(sql.mock.calls[0]?.[0])).toContain("status = 'failed'");
  });

  it("snapshots the latest brain onto a conversation when resolving context", async () => {
    const brainSnapshot = {
      revision: 3,
      content_hash: "brain-hash-1",
      compiled_at: "2026-06-24T00:00:00.000Z",
      compiled_json: {
        businessSummary: "Northline Advisory is a consulting firm.",
        tone: {
          voice: "warm",
          formalityLevel: "balanced",
          preferredGreeting: "Hi, I'm the intake assistant for Northline Advisory.",
          notes: [],
        },
        greeting: "Open with a short welcome.",
        qualificationPosture: ["Ask what they need help with."],
        escalationRules: [],
        forbiddenClaims: ["Never promise outcomes."],
        serviceEmphasis: ["Lead qualification"],
      },
    };
    const conversation = {
      id: "conv-brain",
      firm_id: "firm-a",
      visitor_id: "visitor-a",
      eve_session_id: "eve-1",
      eve_continuation_token: "tok-1",
      eve_stream_index: 4,
      status: "open",
      phase: "listen",
      source_url: "http://localhost/ask/northline-advisory",
      firm_slug: "northline-advisory",
      matter_summary: null,
      primary_service_id: null,
      brain_snapshot: null,
      last_message_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const sql = vi
      .fn()
      .mockResolvedValueOnce([brainSnapshot])
      .mockResolvedValueOnce([
        {
          id: "visitor-a",
          firm_id: "firm-a",
          anonymous_key: "browser-1",
          name: null,
          email: null,
          phone: null,
          company_name: null,
          source: "web",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ])
      .mockResolvedValueOnce([conversation])
      .mockResolvedValueOnce(undefined);
    setSqlForTests(sql as never);

    const result = await resolveConversationContext({
      firmId: "firm-a",
      firmSlug: "northline-advisory",
      eveSessionId: "eve-1",
      clientContext: { firmSlug: "northline-advisory", browserSessionId: "browser-1" },
    });

    expect(result.brainSnapshot).toMatchObject({
      revision: 3,
      contentHash: "brain-hash-1",
    });
    expect(String(sql.mock.calls[3]?.[0])).toContain("brain_snapshot =");
  });

  it("resolves legacy conversations safely when no live brain exists", async () => {
    const conversation = {
      id: "conv-legacy",
      firm_id: "firm-a",
      visitor_id: "visitor-a",
      eve_session_id: "eve-1",
      eve_continuation_token: "tok-1",
      eve_stream_index: 4,
      status: "open",
      phase: "listen",
      source_url: "http://localhost/ask/northline-advisory",
      firm_slug: "northline-advisory",
      matter_summary: null,
      primary_service_id: null,
      brain_snapshot: null,
      last_message_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const sql = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "visitor-a",
          firm_id: "firm-a",
          anonymous_key: "browser-1",
          name: null,
          email: null,
          phone: null,
          company_name: null,
          source: "web",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ])
      .mockResolvedValueOnce([conversation]);
    setSqlForTests(sql as never);

    const result = await resolveConversationContext({
      firmId: "firm-a",
      firmSlug: "northline-advisory",
      eveSessionId: "eve-1",
      clientContext: { firmSlug: "northline-advisory", browserSessionId: "browser-1" },
    });

    expect(result.brainSnapshot).toBeUndefined();
    expect(sql).toHaveBeenCalledTimes(3);
  });
});
