# Release Verification and Completion Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the multitenant platform is complete, isolated, non-streaming, reproducible, and free of concealed unfinished work before release.

**Architecture:** Verification runs independently of implementation modules. A real test database, two adversarial organizations, route-level tests, architecture scans, and production builds provide release evidence.

**Tech Stack:** Vitest, Supertest, Playwright where already available, PostgreSQL catalog queries, shell architecture scans.

**Required UI review inputs:** `/Users/mac/.agents/skills/design-taste-frontend/SKILL.md`, `/Users/mac/taste-skill/skills/soft-skill/SKILL.md`, and the completed `docs/superpowers/plans/multi-tenant-plans/evidence/05a-dashboard-visual-review.md`.

---

### Task 1: Create a requirement-to-test manifest

**Files:**
- Create: `docs/superpowers/plans/multi-tenant-plans/evidence/07-requirement-trace.md`
- Read: `docs/superpowers/specs/2026-06-23-multitenant-platform-design.md`
- Read: `docs/superpowers/plans/multi-tenant-plans/2026-06-23-01-control-plane-foundation.md`
- Read: `docs/superpowers/plans/multi-tenant-plans/2026-06-23-02-postgres-tenant-foundation.md`
- Read: `docs/superpowers/plans/multi-tenant-plans/2026-06-23-03-managed-identity-provisioning.md`
- Read: `docs/superpowers/plans/multi-tenant-plans/2026-06-23-04-knowledge-assistant-control-plane.md`
- Read: `docs/superpowers/plans/multi-tenant-plans/2026-06-23-05-hosted-intake-flue-data-plane.md`
- Read: `docs/superpowers/plans/multi-tenant-plans/2026-06-23-05a-dashboard-design-system.md`
- Read: `docs/superpowers/plans/multi-tenant-plans/2026-06-23-06-lead-operations-workspace.md`

- [ ] List every numbered invariant, milestone-one delivery gate, and milestone-two delivery gate.
- [ ] Map each item to production files, test files, and an executable command.
- [ ] Treat any item without all three mappings as a blocking defect; return to the owning plan and add the missing implementation/test.
- [ ] Record no “manual only” security invariant when it can be automated.

### Task 2: Add a unified architecture verification script

**Files:**
- Create: `scripts/verify-architecture.mjs`
- Create: `scripts/verify-architecture.test.ts`
- Modify: `package.json`

- [ ] Write fixture-based tests proving the script detects each violation.
- [ ] Detect direct web database imports, production chat streaming primitives, tenant repository pool imports, bare organization ID repository arguments, skipped tests, focused tests, placeholders, debug logs, and committed secret-like values.
- [ ] Print file/line/rule for each violation and exit non-zero.
- [ ] Add `npm run verify:architecture`.
- [ ] Run its tests, run it on the repository, fix every finding, and commit with `test: add architecture verification gate`.

### Task 3: Build the adversarial two-tenant release suite

**Files:**
- Create: `tests/release/two-tenant-isolation.test.ts`
- Create: `tests/release/fixtures.ts`
- Create: `tests/release/http-clients.ts`
- Create: `vitest.release.config.ts`
- Modify: `package.json`

- [ ] Provision organizations A and B through the real application flow.
- [ ] Add users, services, private marker knowledge, assistant versions, channels, conversations, contacts, leads, tasks, and booking requests for both.
- [ ] Attempt A→B and B→A access through staff API, intake API, direct guarded Flue prompt, repositories, private search, reference search, and guessed IDs.
- [ ] Attempt missing-context, forged-token, wrong-audience, expired-token, revoked-session, disabled-channel, suspended-organization, and disabled-membership paths.
- [ ] Require `404` or denial responses that do not disclose cross-tenant existence.
- [ ] Add `npm run test:release` and require PASS.
- [ ] Commit with `test: add adversarial tenant release suite`.

### Task 4: Verify idempotency and recovery

**Files:**
- Create: `tests/release/idempotency-recovery.test.ts`

- [ ] Duplicate organization provisioning idempotency keys.
- [ ] Concurrently accept one invitation twice.
- [ ] Submit the same chat turn twice before and after completion.
- [ ] Crash/fail between visitor and assistant persistence using an injected failpoint.
- [ ] Deliver one assessment, booking, and notification outbox event at least twice.
- [ ] Assert one canonical row/side effect and complete audit history.
- [ ] Remove or production-disable failpoints after tests.
- [ ] Commit with `test: verify retry idempotency`.

### Task 5: Verify clean database bootstrap and catalog invariants

**Files:**
- Create: `scripts/audit-database.ts`
- Test: `scripts/audit-database.test.ts`
- Create: `docs/superpowers/plans/multi-tenant-plans/evidence/07-database-audit.txt`

- [ ] Reset only an explicitly named `_test` database.
- [ ] Apply all active migrations from zero twice.
- [ ] Query every tenant table for non-null `organization_id`, `UNIQUE(id, organization_id)`, forced RLS, runtime grants, and composite foreign keys.
- [ ] Query roles and assert runtime/worker/provisioning roles have `rolsuper=false` and `rolbypassrls=false`.
- [ ] Fail on any tenant table absent from the expected inventory or any expected table absent from the catalog.
- [ ] Save the successful catalog report and commit with `test(db): audit tenant catalog invariants`.

### Task 6: Verify non-streaming runtime behavior and latency topology

**Files:**
- Create: `tests/release/non-streaming-chat.test.ts`
- Create: `tests/release/chat-latency.test.ts`
- Create: `docs/superpowers/plans/multi-tenant-plans/evidence/07-chat-topology.txt`

- [ ] Assert session admission calls NestJS once.
- [ ] Assert subsequent turns target guarded Flue `?wait=result` directly.
- [ ] Assert response content type is JSON and contains one complete assistant response.
- [ ] Assert no browser request uses SSE, event-stream GET, stream offset, or continuation token.
- [ ] Assert the UI never renders partial token fragments.
- [ ] Measure p50/p95 one-time admission, cold turn, warm turn, and retrieval; record values without inventing pass thresholds. Fail on regression exceeding a committed baseline by more than the explicitly approved tolerance.
- [ ] Commit with `test(chat): verify non-streaming topology`.

### Task 7: Run failure-mode acceptance tests

**Files:**
- Create: `tests/release/failure-modes.test.ts`
- Create: `docs/superpowers/plans/multi-tenant-plans/evidence/07-failure-matrix.md`

- [ ] Cover every documented ingestion error code and remediation response.
- [ ] Cover invalid auth, role denial, invitation expiry, optimistic concurrency conflict, provider timeout, database rollback, publication conflict, invalid model output, and notification failure.
- [ ] Verify public errors contain correlation IDs and no stack, SQL, token, storage key, provider body, document text, or cross-tenant identifier.
- [ ] Map every case to observed HTTP status, application code, retryability, and audit/log expectation.
- [ ] Commit with `test: verify platform failure modes`.

### Task 8: Perform full code-quality review

**Files:**
- Create: `docs/superpowers/plans/multi-tenant-plans/evidence/07-type-safety-review.md`
- Create: `docs/superpowers/plans/multi-tenant-plans/evidence/07-code-quality-review.md`
- Create: `docs/superpowers/plans/multi-tenant-plans/evidence/07-dashboard-visual-review.md`

- [ ] Run `npm run verify:architecture`.
- [ ] Run `npm run typecheck`, `npm test`, `npm run test:release`, and `npm run build`.
- [ ] Run `npm audit --omit=dev`; classify every finding and block release on unresolved high/critical runtime findings.
- [ ] Inspect all `as any`, `@ts-ignore`, `@ts-expect-error`, non-null assertions, and catch blocks introduced by these plans; remove or justify each in `docs/superpowers/plans/multi-tenant-plans/evidence/07-type-safety-review.md`.
- [ ] Inspect files over 400 lines changed by the work; split mixed responsibilities or record why the file remains cohesive.
- [ ] Confirm all public functions/types have one clear responsibility and framework packages do not leak into domain/application packages.
- [ ] Confirm no Postiz code, namespace, comment, or AGPL-derived source was copied.
- [ ] Reread both required design skills and rerun their preflight/review checklists across overview, conversations, leads, pipeline, booking, follow-up, knowledge, and settings.
- [ ] Reject banned fonts/icons, purple AI gradients, pure black, generic three-card rows, generic borders, harsh shadows, emojis, missing loading/empty/error/forbidden/conflict states, inaccessible motion, `h-screen`, horizontal overflow, and any visual dependency imported without package-manifest verification.
- [ ] Review deterministic screenshots at the four Plan 05a viewports. Fail the release for clipping, overlapping controls, broken baselines, inconsistent radii, weak hierarchy, illegible contrast, undersized touch targets, or pointer/keyboard interaction conflicts.
- [ ] Record architecture, dependency-direction, file-size, copied-code, and unresolved-quality findings in `07-code-quality-review.md`; record the page-by-page skill checklist and screenshot verdict in `07-dashboard-visual-review.md`.

### Task 9: Final completion decision

**Files:**
- Create: `docs/superpowers/plans/multi-tenant-plans/evidence/07-release-decision.md`

- [ ] Produce `07-release-decision.md` with exact command outputs, test counts, requirement-trace status, and a single `PASS` or `BLOCKED` release verdict.
- [ ] Require skipped/focused tests count `0`.
- [ ] Require placeholder scan clean.
- [ ] Require web DB import scan clean.
- [ ] Require streaming scan clean.
- [ ] Require database catalog audit clean.
- [ ] Require two-tenant and idempotency release suites green.
- [ ] List no deferred defects inside approved scope. If any exists, mark release blocked and return it to the owning plan.
- [ ] Commit evidence with `docs: record multitenant release verification`.
