# Lead Operations Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. REQUIRED FOR TASK 9: read and apply `/Users/mac/.agents/skills/design-taste-frontend/SKILL.md` and `/Users/mac/taste-skill/skills/soft-skill/SKILL.md`; Plan `docs/superpowers/plans/multi-tenant-plans/2026-06-23-05a-dashboard-design-system.md` must be complete first. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert meaningful conversations into evidence-backed leads and provide the organization staff workspace for pipeline, booking requests, and manual follow-up.

**Architecture:** Flue emits post-turn outbox events. NestJS workers create append-only AI assessments and candidate leads asynchronously. Staff-authoritative changes flow through NestJS APIs; TanStack server functions remain thin BFF calls.

**Tech Stack:** NestJS, PostgreSQL RLS, TanStack Start, React, Valibot, Vitest, Testing Library.

---

### Task 1: Add contact, lead, pipeline, task, and booking schema

**Files:**
- Create: `packages/db/migrations/009_lead_operations.sql`
- Create: `packages/db/migrations/010_lead_operations_rls.sql`
- Test: `packages/db/tests/integration/lead-schema.test.ts`
- Test: `packages/db/tests/integration/lead-isolation.test.ts`

- [ ] Write invalid-insert tests before SQL.
- [ ] Create `contacts`, `contact_methods`, `leads`, `lead_conversations`, `lead_assessments`, `pipeline_stages`, `lead_stage_events`, `follow_up_tasks`, `booking_requests`, and notification outbox fields.
- [ ] Enforce one verified contact method per normalized value within an organization, not globally.
- [ ] Allow one contact to have many leads and one lead to have many conversations; constrain one conversation to one active lead.
- [ ] Map stages to stable categories `new`, `qualified`, `booked`, `won`, `lost`, `dormant`.
- [ ] Use composite ownership foreign keys and forced RLS everywhere.
- [ ] Run two-organization tests for every relationship and commit with `feat(db): add isolated lead operations schema`.

### Task 2: Implement post-turn assessment processing

**Files:**
- Create: `packages/contracts/src/lead-assessment.ts`
- Create: `packages/domain/src/lead-qualification.ts`
- Create: `packages/application/src/leads/process-conversation-assessment.ts`
- Create: `packages/application/src/leads/ports.ts`
- Create: `packages/db/src/tenant/lead-assessment.repository.ts`
- Create: `apps/api/src/leads/assessment.processor.ts`
- Test: `packages/domain/src/lead-qualification.test.ts`
- Test: `packages/application/src/leads/process-conversation-assessment.test.ts`
- Test: `packages/db/tests/integration/lead-assessment.repository.integration.test.ts`
- Test: `apps/api/src/leads/assessment.processor.test.ts`

- [ ] Test greetings/spam/tests remain conversation-only; genuine service intent or contact capture crosses the lead threshold.
- [ ] Validate model output strictly: service, urgency, fit, completeness, summary, missing information, recommended action, confidence, and evidence message/source IDs.
- [ ] Reject evidence IDs outside the active organization/conversation.
- [ ] Append assessments; never update staff stage/assignment/disposition.
- [ ] Deduplicate by outbox event ID and assessment fingerprint.
- [ ] Test malformed model output, provider timeout, repeated event, and organization mismatch.
- [ ] Commit with `feat(leads): process evidence backed assessments`.

### Task 3: Create contacts and leads safely

**Files:**
- Create: `packages/application/src/leads/promote-conversation.ts`
- Create: `packages/application/src/leads/dismiss-conversation.ts`
- Create: `packages/application/src/contacts/associate-contact.ts`
- Create: `packages/db/src/tenant/contact.repository.ts`
- Create: `packages/db/src/tenant/lead.repository.ts`
- Test: `packages/application/src/contacts/associate-contact.test.ts`
- Test: `packages/application/src/leads/promote-conversation.test.ts`
- Test: `packages/application/src/leads/dismiss-conversation.test.ts`
- Test: `packages/db/tests/integration/contact.repository.integration.test.ts`
- Test: `packages/db/tests/integration/lead.repository.integration.test.ts`

- [ ] Test verified email/phone matching only within organization; names never merge automatically.
- [ ] Test the same contact can own multiple leads for different enquiries.
- [ ] Test automatic promotion, manual promotion, manual dismissal, repeated promotion, and concurrent promotion.
- [ ] Create leads unassigned in the organization's `new` stage.
- [ ] Preserve immutable origin and conversation linkage.
- [ ] Commit with `feat(leads): promote conversations into leads`.

### Task 4: Implement staff-authoritative lead commands

**Files:**
- Create: `packages/contracts/src/leads.ts`
- Create: `packages/application/src/leads/change-lead-stage.ts`
- Create: `packages/application/src/leads/assign-lead.ts`
- Create: `packages/application/src/leads/set-lead-disposition.ts`
- Create: `apps/api/src/leads/leads.module.ts`
- Create: `apps/api/src/leads/leads.controller.ts`
- Test: `packages/application/src/leads/change-lead-stage.test.ts`
- Test: `packages/application/src/leads/assign-lead.test.ts`
- Test: `packages/application/src/leads/set-lead-disposition.test.ts`
- Test: `apps/api/test/lead-commands.e2e.test.ts`

- [ ] Test viewer denial, staff allowed operational changes, admin/owner access, cross-organization IDs, invalid stage category transitions, inactive assignee, and optimistic concurrency conflict.
- [ ] Require expected lead version for mutations and return `409` on stale writes.
- [ ] Append stage events and audit records; do not overwrite history.
- [ ] Manual assignment accepts only an active member of the same organization.
- [ ] Commit with `feat(api): add staff lead commands`.

### Task 5: Implement pipeline configuration

**Files:**
- Create: `packages/contracts/src/pipeline.ts`
- Create: `packages/domain/src/pipeline.ts`
- Create: `packages/application/src/pipeline/list-pipeline-stages.ts`
- Create: `packages/application/src/pipeline/create-pipeline-stage.ts`
- Create: `packages/application/src/pipeline/update-pipeline-stage.ts`
- Create: `packages/application/src/pipeline/reorder-pipeline-stages.ts`
- Create: `packages/application/src/pipeline/delete-pipeline-stage.ts`
- Create: `packages/db/src/tenant/pipeline.repository.ts`
- Create: `apps/api/src/pipeline/pipeline.module.ts`
- Create: `apps/api/src/pipeline/pipeline.controller.ts`
- Test: `packages/domain/src/pipeline.test.ts`
- Test: `packages/application/src/pipeline/list-pipeline-stages.test.ts`
- Test: `packages/application/src/pipeline/create-pipeline-stage.test.ts`
- Test: `packages/application/src/pipeline/update-pipeline-stage.test.ts`
- Test: `packages/application/src/pipeline/reorder-pipeline-stages.test.ts`
- Test: `packages/application/src/pipeline/delete-pipeline-stage.test.ts`
- Test: `packages/db/tests/integration/pipeline.repository.integration.test.ts`
- Test: `apps/api/test/pipeline.e2e.test.ts`

- [ ] Seed a default industry template during provisioning.
- [ ] Test rename, reorder, add, stable category mapping, duplicate position, and deletion of a stage currently used by a lead.
- [ ] Prevent deleting in-use stages; require migration to a replacement stage.
- [ ] Restrict configuration to owner/admin.
- [ ] Commit with `feat(pipeline): add configurable organization stages`.

### Task 6: Implement follow-up tasks and booking requests

**Files:**
- Create: `packages/contracts/src/follow-ups.ts`
- Create: `packages/contracts/src/booking-requests.ts`
- Create: `packages/application/src/follow-ups/create-follow-up.ts`
- Create: `packages/application/src/follow-ups/complete-follow-up.ts`
- Create: `packages/application/src/follow-ups/list-due-follow-ups.ts`
- Create: `packages/application/src/bookings/create-booking-request.ts`
- Create: `packages/application/src/bookings/change-booking-status.ts`
- Create: `packages/application/src/bookings/list-booking-requests.ts`
- Create: `packages/db/src/tenant/follow-up.repository.ts`
- Create: `packages/db/src/tenant/booking-request.repository.ts`
- Create: `apps/api/src/follow-ups/follow-ups.module.ts`
- Create: `apps/api/src/follow-ups/follow-ups.controller.ts`
- Create: `apps/api/src/bookings/bookings.module.ts`
- Create: `apps/api/src/bookings/bookings.controller.ts`
- Test: `packages/application/src/follow-ups/create-follow-up.test.ts`
- Test: `packages/application/src/follow-ups/complete-follow-up.test.ts`
- Test: `packages/application/src/follow-ups/list-due-follow-ups.test.ts`
- Test: `packages/application/src/bookings/create-booking-request.test.ts`
- Test: `packages/application/src/bookings/change-booking-status.test.ts`
- Test: `packages/application/src/bookings/list-booking-requests.test.ts`
- Test: `packages/db/tests/integration/follow-up.repository.integration.test.ts`
- Test: `packages/db/tests/integration/booking-request.repository.integration.test.ts`
- Test: `apps/api/test/follow-ups.e2e.test.ts`
- Test: `apps/api/test/booking-requests.e2e.test.ts`

- [ ] Booking status is `requested`, `confirmed`, `reschedule_requested`, `cancelled`; assistant can create only `requested`.
- [ ] Test assistant cannot claim confirmation, staff confirmation is audited, duplicate request is idempotent, and cross-tenant service/contact/lead IDs fail.
- [ ] Test follow-up ownership, due date, completion, overdue query, and inactive assignee.
- [ ] Commit with `feat(leads): add bookings and follow ups`.

### Task 7: Add idempotent email notifications

**Files:**
- Create: `packages/application/src/notifications/notification.port.ts`
- Create: `packages/application/src/notifications/process-notification-event.ts`
- Create: `apps/api/src/notifications/email-notification.adapter.ts`
- Create: `apps/api/src/notifications/email.config.ts`
- Create: `apps/api/src/notifications/notification.processor.ts`
- Test: `packages/application/src/notifications/process-notification-event.test.ts`
- Test: `apps/api/src/notifications/email-notification.adapter.test.ts`
- Test: `apps/api/src/notifications/notification.processor.test.ts`

- [ ] Support only qualified lead, urgent/handoff, booking request, and overdue follow-up events.
- [ ] Before coding, run `npm view resend version`, install that exact version in `@leadpilot/api`, and commit the lockfile. Keep Resend behind `NotificationPort`; domain/application packages must not import it.
- [ ] Store provider message ID and dedupe key before marking delivered.
- [ ] Test provider timeout/retry, duplicate event, missing recipients, and suspended organization.
- [ ] Keep email bodies minimal; do not include full transcript or knowledge content.
- [ ] Commit with `feat(notifications): deliver idempotent lead alerts`.

### Task 8: Expose staff query APIs

**Files:**
- Create: `packages/application/src/leads/list-leads.ts`
- Create: `packages/application/src/leads/get-lead-detail.ts`
- Create: `packages/application/src/conversations/list-conversations.ts`
- Create: `packages/application/src/conversations/get-conversation.ts`
- Create: `packages/db/src/tenant/lead-query.repository.ts`
- Create: `packages/db/src/tenant/conversation-query.repository.ts`
- Modify: `apps/api/src/leads/leads.controller.ts`
- Create: `apps/api/src/conversations/conversations.module.ts`
- Create: `apps/api/src/conversations/conversations.controller.ts`
- Test: `packages/application/src/leads/list-leads.test.ts`
- Test: `packages/application/src/leads/get-lead-detail.test.ts`
- Test: `packages/application/src/conversations/list-conversations.test.ts`
- Test: `packages/application/src/conversations/get-conversation.test.ts`
- Test: `packages/db/tests/integration/lead-query.repository.integration.test.ts`
- Test: `packages/db/tests/integration/conversation-query.repository.integration.test.ts`
- Test: `apps/api/test/lead-queries.e2e.test.ts`
- Test: `apps/api/test/conversation-queries.e2e.test.ts`

- [ ] Require cursor pagination and bounded page size.
- [ ] Filter by stage, service, urgency, assignment, booking state, and due follow-up.
- [ ] Return structured summary and evidence references without internal model/provider fields.
- [ ] Test guessed conversation/lead IDs from organization B return not found under A.
- [ ] Commit with `feat(api): expose scoped lead workspace queries`.

### Task 9: Migrate the TanStack staff workspace to NestJS

**Files:**
- Replace: `apps/web/src/features/dashboard/server.ts`
- Modify: `apps/web/src/features/dashboard/content-intelligence-actions.ts`
- Modify: `apps/web/src/routes/dashboard.$firmSlug.tsx`
- Modify: `apps/web/src/routes/dashboard.$firmSlug.index.tsx`
- Modify: `apps/web/src/routes/dashboard.$firmSlug.leads.tsx`
- Modify: `apps/web/src/routes/dashboard.$firmSlug.leads.index.tsx`
- Modify: `apps/web/src/routes/dashboard.$firmSlug.leads.$conversationId.tsx`
- Modify: `apps/web/src/routes/dashboard.$firmSlug.content.tsx`
- Modify: `apps/web/src/features/dashboard/components/dashboard-overview.tsx`
- Modify: `apps/web/src/features/dashboard/components/conversation-leads.tsx`
- Modify: `apps/web/src/features/dashboard/components/conversation-context-panel.tsx`
- Modify: `apps/web/src/features/dashboard/components/booking-detail.tsx`
- Modify: `apps/web/src/features/dashboard/components/booking-requests.tsx`
- Create: `apps/web/src/features/leads/lead-actions.ts`
- Create: `apps/web/src/features/leads/components/lead-list.tsx`
- Create: `apps/web/src/features/leads/components/lead-detail.tsx`
- Create: `apps/web/src/features/leads/components/lead-assessment-panel.tsx`
- Create: `apps/web/src/features/pipeline/pipeline-actions.ts`
- Create: `apps/web/src/features/pipeline/components/pipeline-board.tsx`
- Create: `apps/web/src/features/pipeline/components/pipeline-column.tsx`
- Create: `apps/web/src/features/pipeline/components/pipeline-lead-card.tsx`
- Create: `apps/web/src/features/follow-ups/components/follow-up-list.tsx`
- Create: `apps/web/e2e/lead-operations-visual.spec.ts`
- Create: `apps/web/e2e/fixtures/lead-operations-fixtures.ts`
- Test: `apps/web/src/features/dashboard/server.test.ts`
- Test: `apps/web/src/features/dashboard/content-intelligence-actions.test.ts`
- Test: `apps/web/src/features/dashboard/components/dashboard-overview.test.tsx`
- Test: `apps/web/src/features/dashboard/components/conversation-leads.test.tsx`
- Test: `apps/web/src/features/dashboard/components/conversation-context-panel.test.tsx`
- Test: `apps/web/src/features/dashboard/components/booking-requests.test.tsx`
- Test: `apps/web/src/features/leads/lead-actions.test.ts`
- Test: `apps/web/src/features/leads/components/lead-list.test.tsx`
- Test: `apps/web/src/features/leads/components/lead-detail.test.tsx`
- Test: `apps/web/src/features/leads/components/lead-assessment-panel.test.tsx`
- Test: `apps/web/src/features/pipeline/pipeline-actions.test.ts`
- Test: `apps/web/src/features/pipeline/components/pipeline-board.test.tsx`
- Test: `apps/web/src/features/pipeline/components/pipeline-column.test.tsx`
- Test: `apps/web/src/features/pipeline/components/pipeline-lead-card.test.tsx`
- Test: `apps/web/src/features/follow-ups/components/follow-up-list.test.tsx`
- Test: `apps/web/src/features/dashboard/components/booking-detail.test.tsx`
- Test: `apps/web/src/routes/dashboard.$firmSlug.index.test.tsx`
- Test: `apps/web/src/routes/dashboard.$firmSlug.leads.index.test.tsx`
- Test: `apps/web/src/routes/dashboard.$firmSlug.leads.$conversationId.test.tsx`

- [ ] Before editing UI, reread both required design skills and `docs/superpowers/plans/multi-tenant-plans/evidence/05a-dashboard-visual-review.md`; record how Soft Structuralism and Asymmetrical Bento apply to each page in the Task 9 implementation report.
- [ ] Write contract tests proving every server function calls `apiRequest()` and forwards authenticated organization context.
- [ ] Remove all `@leadpilot/db` imports from dashboard/content/lead code.
- [ ] Implement overview, conversation inbox, lead list/detail, pipeline board, booking queue, and manual follow-up UI against API contracts.
- [ ] Use Plan 05a's `WorkspaceSurface`, `Field`, `StatePanel`, `MotionList`, fixed tokens, typography, and Phosphor icon policy. Do not create page-local card, button, input, shadow, radius, color, or motion systems.
- [ ] Pipeline movement must be operable by pointer and keyboard, announce the resulting stage, preserve focus, and use transform/opacity-only animation; reduced-motion mode must remove nonessential movement.
- [ ] Preserve loading, empty, forbidden, not-found, conflict, and retry states.
- [ ] In `lead-operations-visual.spec.ts`, use the four named Playwright projects from Plan 05a and call `toHaveScreenshot()` with the exact names `overview.png`, `conversations.png`, `lead-list.png`, `lead-detail.png`, `pipeline.png`, `booking.png`, and `follow-ups.png`; reject clipping, horizontal overflow, broken hierarchy, touch-target conflicts, or mismatched radii.
- [ ] Do not add employee-management UI beyond invite/role/deactivate controls from Plan 03.
- [ ] Run web tests/typecheck and commit with `refactor(web): use lead operations API`.

### Task 10: Enforce zero direct database access from web

**Files:**
- Create: `apps/web/src/architecture/no-direct-db-imports.test.ts`
- Update: `docs/superpowers/plans/multi-tenant-plans/evidence/01-current-web-db-imports.txt`

- [ ] Recursively scan non-test `apps/web/src` files and fail on `@leadpilot/db`, `@neondatabase`, `pg`, raw `DATABASE_URL`, or SQL template usage.
- [ ] Run the test. If it reports a production file not already named in Tasks 9 or Plan 05 Task 8, stop and amend the owning task's `Files` block with that exact path before changing it; do not add allowlists or make an unlisted production edit.
- [ ] Run `rg -n "@leadpilot/db|@neondatabase|DATABASE_URL|from ['\"]pg['\"]" apps/web/src`; require no production result.
- [ ] Commit with `test(web): prohibit direct database access`.

### Task 11: Lead operations completion audit

**Files:**
- Create: `docs/superpowers/plans/multi-tenant-plans/evidence/06-role-matrix.md`
- Create: `docs/superpowers/plans/multi-tenant-plans/evidence/06-transition-matrix.md`
- Create: `docs/superpowers/plans/multi-tenant-plans/evidence/06-isolation-results.md`

- [ ] Execute two-organization conversation/contact/lead/pipeline/task/booking fixtures.
- [ ] Attempt every A→B read and mutation through API and repository integration tests.
- [ ] Verify AI assessment cannot change staff-owned fields.
- [ ] Verify duplicate outbox and booking events do not duplicate records or email.
- [ ] Run the full web import boundary test.
- [ ] Save actor/command authorization in `06-role-matrix.md`, lead/pipeline/booking/follow-up transitions in `06-transition-matrix.md`, and every A→B/B→A attempt in `06-isolation-results.md`.
- [ ] Run all workspace tests/typechecks/builds and produce the completion report.
