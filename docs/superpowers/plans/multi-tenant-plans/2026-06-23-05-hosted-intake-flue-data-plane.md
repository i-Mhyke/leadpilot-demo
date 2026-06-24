# Hosted Intake and Flue Data Plane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create organization-bound hosted intake sessions and run direct browser-to-Flue request/response chat without NestJS turn proxying or text streaming.

**Architecture:** NestJS performs one-time session admission and signs a short-lived credential. Flue verifies it locally, resolves a persisted opaque binding, executes `?wait=result`, persists the turn, and emits idempotent outbox work.

**Tech Stack:** NestJS, Flue `?wait=result`, Hono route middleware, `jose`, PostgreSQL RLS, React, Vitest.

---

### Task 1: Add intake session, binding, turn, and outbox schema

**Files:**
- Create: `packages/db/migrations/007_intake_conversations.sql`
- Create: `packages/db/migrations/008_intake_rls.sql`
- Test: `packages/db/tests/integration/intake-schema.test.ts`
- Test: `packages/db/tests/integration/intake-isolation.test.ts`

- [ ] Test composite ownership for channel/session/conversation/message/binding/outbox relationships.
- [ ] Create `intake_sessions`, `agent_instance_bindings`, `conversations`, `conversation_messages`, `turn_requests`, and `outbox_events`.
- [ ] Store only credential hash, expiry, revocation, and last-use metadata; never raw credential.
- [ ] Put a unique idempotency constraint on `(organization_id, conversation_id, client_turn_id)`.
- [ ] Put a unique outbox dedupe key on `(organization_id, event_type, aggregate_id, idempotency_key)`.
- [ ] Enable/force RLS and run A→B/B→A tests.
- [ ] Commit with `feat(db): add isolated intake session schema`.

### Task 2: Implement one-time channel session admission in NestJS

**Files:**
- Create: `packages/contracts/src/intake.ts`
- Create: `packages/application/src/intake/create-intake-session.ts`
- Create: `packages/db/src/tenant/intake-session.repository.ts`
- Create: `apps/api/src/public-intake/public-intake.module.ts`
- Create: `apps/api/src/public-intake/public-intake.controller.ts`
- Test: `packages/application/src/intake/create-intake-session.test.ts`
- Test: `packages/db/tests/integration/intake-session.repository.integration.test.ts`
- Test: `apps/api/test/public-intake.e2e.test.ts`

- [ ] Test unknown/disabled channel, suspended organization, rate limit, successful creation, replay by admission idempotency key, and absence of private organization configuration in the response.
- [ ] Resolve a published channel by public slug in a narrowly scoped security-definer function that returns only organization/channel IDs after status checks.
- [ ] In one transaction create intake session, conversation, random opaque Flue ID, binding, and audit/telemetry record.
- [ ] Return `{ sessionId, agentInstanceId, chatToken, expiresAt, agentBaseUrl }`.
- [ ] Confirm this endpoint is called once per new browser conversation, not per message.
- [ ] Commit with `feat(intake): admit hosted conversations`.

### Task 3: Sign and verify scoped chat credentials

**Files:**
- Create: `apps/api/src/public-intake/chat-token.signer.ts`
- Create: `apps/agent/src/agent/lib/chat-token-verifier.ts`
- Create: `packages/contracts/src/chat-token.ts`
- Test: `apps/api/src/public-intake/chat-token.signer.test.ts`
- Test: `apps/agent/tests/lib/chat-token-verifier.test.ts`
- Test: `packages/contracts/src/chat-token.test.ts`

- [ ] Generate an Ed25519 test keypair. API config receives the private key; agent config receives only the public key.
- [ ] Add the exact `jose` version selected in Plan 03 to `apps/agent/package.json`; do not rely on undeclared workspace hoisting.
- [ ] Sign claims `iss`, `aud: leadpilot-agent`, `sub: intakeSessionId`, `jti`, `aid: agentInstanceId`, `iat`, and short `exp`. Do not include organization ID or private configuration.
- [ ] Test wrong audience, issuer, algorithm, key, instance ID, expiry, missing claims, and valid token.
- [ ] Never accept `alg=none`, symmetric fallback, or keys from token headers.
- [ ] Commit with `feat(intake): secure agent chat credentials`.

### Task 4: Guard Flue prompt routes and disable product stream reads

**Files:**
- Modify: `apps/agent/src/agents/leadpilot.ts`
- Modify: `apps/agent/src/app.ts`
- Create: `apps/agent/src/agent/lib/intake-request-context.ts`
- Test: `apps/agent/tests/intake-route-auth.test.ts`

- [ ] Write tests proving POST without/invalid/mismatched token returns `401/403`, valid token reaches the agent, and GET/HEAD event-stream access is rejected for hosted intake credentials.
- [ ] In the exported Flue `route` middleware, allow only authenticated POST prompt requests for hosted intake. Match token `aid` to route ID before `next()`.
- [ ] Resolve session/binding status after signature verification and reject revoked session, disabled channel, or suspended organization.
- [ ] Remove `/api/leadpilot/chat` dispatch instructions and all responses containing `streamUrl` or `live=sse`.
- [ ] Preserve `/health` without exposing tenant state.
- [ ] Commit with `feat(agent): guard non-streaming intake prompts`.

### Task 5: Replace client-controlled firm binding

**Files:**
- Replace: `apps/agent/src/agent/lib/persistence.ts`
- Replace: `apps/agent/src/agent/lib/session-scope.ts`
- Replace: `apps/agent/src/agent/lib/client-context.ts`
- Create: `apps/agent/src/agent/lib/agent-context-loader.ts`
- Create: `packages/db/src/tenant/agent-binding.repository.ts`
- Test: `apps/agent/tests/lib/agent-context-loader.test.ts`
- Test: `apps/agent/tests/lib/session-scope.test.ts`
- Test: `apps/agent/tests/lib/client-context.test.ts`
- Test: `packages/db/tests/integration/agent-binding.repository.integration.test.ts`

- [ ] Test opaque ID lookup, missing binding, token/session mismatch, cold load, warm cache, config version invalidation, channel disable, and organization suspension.
- [ ] Delete `${firmSlug}/${browserSessionId}` parsing and process-global authority maps.
- [ ] Load one context snapshot containing binding, published assistant, profile, active services, channel overrides, and reference grants.
- [ ] Cache by binding/config version with short TTL; every cold path must work and every revocation must override cache.
- [ ] Change tools to receive a resolved context object; remove tenant IDs from tool schemas.
- [ ] Commit with `refactor(agent): bind turns to persisted intake context`.

### Task 6: Persist complete turns and retry `?wait=result` safely

**Files:**
- Create: `packages/application/src/intake/process-chat-turn.ts`
- Create: `packages/db/src/tenant/conversation.repository.ts`
- Create: `packages/db/src/tenant/outbox.repository.ts`
- Modify: `apps/agent/src/agents/leadpilot.ts`
- Modify: `apps/agent/src/tools/create_booking_request.ts`
- Modify: `apps/agent/src/tools/evaluate_conversation_readiness.ts`
- Modify: `apps/agent/src/tools/get_firm_profile.ts`
- Modify: `apps/agent/src/tools/handoff_to_human.ts`
- Modify: `apps/agent/src/tools/record_conversation_topic.ts`
- Modify: `apps/agent/src/tools/search_knowledge.ts`
- Modify: `apps/agent/src/tools/upsert_lead.ts`
- Test: `packages/application/src/intake/process-chat-turn.test.ts`
- Test: `packages/db/tests/integration/conversation.repository.integration.test.ts`
- Test: `packages/db/tests/integration/outbox.repository.integration.test.ts`
- Test: `apps/agent/tests/leadpilot-turn-recovery.test.ts`

- [ ] Require `x-leadpilot-turn-id` UUID from the browser and include it in turn context.
- [ ] Before inference, reserve the turn idempotently and persist the visitor message exactly once.
- [ ] After successful Flue completion, persist the assistant response and outbox events in one organization-scoped transaction.
- [ ] On duplicate completed turn, return the stored assistant response without invoking the model or tools.
- [ ] On duplicate in-progress turn, return a stable `409 turn_in_progress`; the client retries with bounded backoff using the same ID.
- [ ] Test process interruption after visitor persistence and before assistant persistence; retry must not duplicate either message or side effects.
- [ ] Commit with `feat(agent): persist idempotent complete turns`.

### Task 7: Replace the web chat transport with request/response only

**Files:**
- Replace: `apps/web/src/features/chat/flue-session.ts`
- Replace: `apps/web/src/features/chat/use-flue-agent.tsx` with `apps/web/src/features/chat/use-chat-turn.ts`
- Modify: `apps/web/src/features/chat/components/chat-thread.tsx`
- Modify: `apps/web/src/features/chat/components/chat-composer.tsx`
- Modify: `apps/web/src/features/chat/components/chat-status-bar.tsx`
- Modify: `apps/web/src/features/chat/copy.ts`
- Modify: `apps/web/src/features/chat/hooks/use-demo-sessions.ts`
- Create: `apps/web/src/features/chat/intake-session-client.ts`
- Test: `apps/web/src/features/chat/flue-session.test.ts`
- Test: `apps/web/src/features/chat/use-chat-turn.test.tsx`
- Test: `apps/web/src/features/chat/intake-session-client.test.ts`
- Test: `apps/web/src/features/chat/components/chat-thread.test.tsx`
- Test: `apps/web/src/features/chat/components/chat-composer.test.tsx`
- Test: `apps/web/src/features/chat/components/chat-status-bar.test.tsx`
- Delete after replacement: `apps/web/src/features/chat/eve-session.ts`
- Delete after replacement: `apps/web/src/features/chat/eve-session.test.ts`
- Delete after replacement: `apps/web/src/features/chat/turn-recovery.ts`
- Delete after replacement: `apps/web/src/features/chat/turn-recovery.test.ts`
- Delete after replacement: `apps/web/src/features/chat/chat-recovery-flow.ts`
- Delete after replacement: `apps/web/src/features/chat/chat-recovery-flow.test.ts`
- Delete after replacement: `apps/web/src/features/chat/merge-session-cursor.ts`
- Delete after replacement: `apps/web/src/features/chat/session-continuity.test.ts`
- Delete after replacement: `apps/web/src/features/chat/cursor-persistence.ts`
- Delete after replacement: `apps/web/src/features/chat/cursor-persistence.test.ts`
- Delete after replacement: `apps/web/src/features/chat/cursor-contract.test.ts`

- [ ] Test session admission is one-time, message POST targets Flue directly with `?wait=result`, NestJS is not called for turns, full response renders once, duplicate retry reuses turn ID, and abort/timeout shows safe retry UI.
- [ ] Reduce status to `idle | submitted | error | done`; remove `streaming`.
- [ ] Remove `streamIndex`, continuation tokens, reconciliation, NDJSON readers, partial-message parsing, and `FlueStreamEvent` from production chat types.
- [ ] Do not persist the turn from a browser follow-up server function; Flue owns persistence.
- [ ] Keep a loading/typing indicator while the complete response is pending, but do not label props or copy as streaming.
- [ ] Run all web chat tests and commit with `refactor(web): use complete Flue chat responses`.

### Task 8: Remove TanStack chat database access

**Files:**
- Replace: `apps/web/src/features/chat/chat-actions.ts`
- Modify: `apps/web/src/routes/ask.$firmSlug.tsx`
- Modify: `apps/web/src/features/chat/components/chat-thread.tsx`
- Test: `apps/web/src/features/chat/chat-actions.test.ts`
- Test: `apps/web/src/routes/ask.$firmSlug.test.tsx`

- [ ] Move history and delete operations behind NestJS endpoints protected by the intake credential or staff membership as appropriate.
- [ ] Replace every `@leadpilot/db` import with `apiRequest()`.
- [ ] Delete cursor persistence and `persistConversationTurn` server functions.
- [ ] Verify browser session IDs cannot request another conversation.
- [ ] Run `rg -n '@leadpilot/db' apps/web/src/features/chat`; require no output.
- [ ] Commit with `refactor(web): remove chat database access`.

### Task 9: Non-streaming and latency completion audit

**Files:**
- Create: `docs/superpowers/plans/multi-tenant-plans/evidence/05-chat-topology.md`
- Create: `docs/superpowers/plans/multi-tenant-plans/evidence/05-latency-results.md`
- Create: `docs/superpowers/plans/multi-tenant-plans/evidence/05-recovery-matrix.md`

- [ ] Run `rg -n 'EventSource|text/event-stream|live=sse|streamIndex|continuationToken|ReadableStream|streaming' apps/web/src/features/chat apps/agent/src`; review every result and require no production chat streaming machinery.
- [ ] Verify browser network trace: one NestJS session request, then direct Flue POSTs with `?wait=result`; no SSE/GET stream requests.
- [ ] Measure p50/p95 session admission, cold turn, warm turn, retrieval, and complete response duration.
- [ ] Test expired/revoked token, disabled channel, suspended organization, wrong agent ID, duplicate turn, and interrupted wait.
- [ ] Save the browser/API/Flue request topology in `05-chat-topology.md`, measured p50/p95 results in `05-latency-results.md`, and token/session/turn failure cases in `05-recovery-matrix.md`.
- [ ] Run web/agent/application/db/API tests, typechecks, and builds; produce the completion report.
