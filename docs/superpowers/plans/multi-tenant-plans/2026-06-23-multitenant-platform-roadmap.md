# Multitenant Platform Implementation Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved organization-first LeadPilot architecture through small, independently verifiable plans.

**Architecture:** TanStack Start is the UI/BFF, NestJS is the staff and configuration control plane, and Flue is the direct non-streaming conversation data plane. PostgreSQL RLS and composite ownership constraints remain the final tenant-isolation boundary.

**Tech Stack:** TypeScript, npm workspaces, TanStack Start, NestJS, Flue, PostgreSQL, pgvector, Vitest, Supertest.

---

## Required execution order

1. `docs/superpowers/plans/multi-tenant-plans/2026-06-23-01-control-plane-foundation.md`
2. `docs/superpowers/plans/multi-tenant-plans/2026-06-23-02-postgres-tenant-foundation.md`
3. `docs/superpowers/plans/multi-tenant-plans/2026-06-23-03-managed-identity-provisioning.md`
4. `docs/superpowers/plans/multi-tenant-plans/2026-06-23-04-knowledge-assistant-control-plane.md`
5. `docs/superpowers/plans/multi-tenant-plans/2026-06-23-05-hosted-intake-flue-data-plane.md`
6. `docs/superpowers/plans/multi-tenant-plans/2026-06-23-05a-dashboard-design-system.md`
7. `docs/superpowers/plans/multi-tenant-plans/2026-06-23-06-lead-operations-workspace.md`
8. `docs/superpowers/plans/multi-tenant-plans/2026-06-23-07-release-verification-audit.md`

## Specification coverage

| Specification area | Owning plan |
|---|---|
| Three-app runtime and package boundaries | 01, 05, 07 |
| PostgreSQL roles, tenant transactions, composite ownership, forced RLS | 02, 07 |
| OIDC identity, opaque sessions, membership roles, superadmin provisioning | 03, 07 |
| Organization suspension, deletion recovery, and purge | 03, 07 |
| Business profile, services, intake rules, assistant versions, channels | 04 |
| Private knowledge, platform references, ingestion errors, preview, publication, rollback | 04, 07 |
| Hosted intake credential, opaque Flue binding, direct `?wait=result`, no streaming | 05, 07 |
| Premium workspace design system, component states, responsive and accessibility gates | 05a, 06, 07 |
| Conversations, contacts, leads, pipeline, booking requests, follow-ups, notifications | 06, 07 |
| Audit, safe errors, idempotency, latency, two-tenant adversarial verification | all plans, finalized by 07 |

Do not start a later plan while an earlier plan has failing tests, an incomplete review report, skipped acceptance criteria, or uncommitted changes. The workspace is currently not a Git repository; create or attach it to the intended repository before executing commit steps.

## Non-negotiable invariants

- `organization_id` is the private-data boundary.
- Tenant context comes from authenticated membership, signed intake session, or trusted worker job; never from model input or a route slug alone.
- Tenant-owned relationships use composite foreign keys.
- Runtime database roles cannot bypass forced RLS.
- `apps/web` never imports `@leadpilot/db`.
- NestJS does not proxy live chat turns.
- Hosted chat calls guarded Flue `?wait=result` endpoints and receives complete responses.
- Production chat contains no SSE, text-token streaming, stream cursor, event-stream recovery, or continuation-token logic.
- Flue memory caches are performance optimizations, not tenant authority.
- Draft or failed knowledge is never live.
- Organization knowledge is never shared; platform references require explicit grants.
- All retried side effects are idempotent.
- Postiz is a behavioral reference only. Do not copy AGPL source.
- Every dashboard task must read and apply `/Users/mac/.agents/skills/design-taste-frontend/SKILL.md` and `/Users/mac/taste-skill/skills/soft-skill/SKILL.md` before changing UI.

## File-system and function-contract rules

- The `Files:` block in each task is authoritative. Do not create, delete, rename, or modify a production file not listed there.
- If implementation proves another production file is necessary, stop that task, amend the plan with the exact path, responsibility, export, test path, and verification command, then resume.
- Each new behavior file has one primary named export derived mechanically from the filename, with no default export: `create-service.ts` → `createService`, `service.repository.ts` → `ServiceRepository`, `lead-list.tsx` → `LeadList`, and `leads.controller.ts` → `LeadsController`. Tests must import that exact named export. Secondary exports are limited to that file's `Input`, `Output`, `Dependencies`, props, and error-code types.
- Application use-case functions accept an immutable authenticated request/worker context first, a validated input object second, and a named dependency/port object third; they return a typed `Result`/documented application error and never accept a pool, raw SQL client, request object, or model-supplied organization identifier. Repository constructors receive only the scoped transaction capability defined in Plan 02; tenant repository methods may not accept an organization ID as a substitute for scoped context.
- Do not create barrel files except the explicit package `src/index.ts` files listed by a task.
- Test doubles belong in the named test file or a listed `tests/helpers/` file. Do not add untracked `utils.ts`, `helpers.ts`, `common.ts`, or `misc.ts` dumping grounds.
- At task completion, run `git diff --name-status HEAD` and compare every path against the task `Files:` block. Any unlisted path blocks completion until the plan is amended or the change is removed.
- The executor must report every exported symbol added or changed and the test that exercises it.

## Per-task execution protocol

Every production file and every test file must appear as a literal path in the task's `Files:` block. Generic entries such as “unit tests,” “repository integration tests,” “API E2E tests,” “component tests,” “matching tests,” directory wildcards, or “modify callers” are prohibited. A single broad test file may not be used to avoid testing individual state machines, guards, repositories, adapters, server functions, or stateful UI components.

For frontend tasks, the named design skills are required inputs, not optional references. The completion report must state the chosen vibe/layout archetypes, dependency checks, typography, palette, motion strategy, responsive behavior, empty/loading/error/conflict coverage, accessibility results, and screenshot paths.

Every task in every plan must follow this order:

1. Read the named source and reference files.
2. Record the invariant the task establishes in the task work log.
3. Write the smallest failing test.
4. Run only that test and capture the expected failure.
5. Implement the smallest production change.
6. Run the targeted test and capture the pass.
7. Run the package typecheck and package test suite.
8. Inspect the diff for unrelated edits, debug logging, broad casts, disabled checks, and secret material.
9. Commit only the task files with the plan's commit message.

The executor may not mark a checkbox complete based only on code inspection. Each completed task requires command output.

## Mandatory review cycle after every plan

### Pass 1: requirement trace

Create a table mapping every plan task and invariant to concrete files and tests. An unmapped requirement means the plan is incomplete.

### Pass 2: tenant-boundary review

Search changed files for `organizationId`, `organization_id`, raw IDs, route slugs, headers, and database clients. Verify every private read and write obtains tenant context through the approved boundary.

### Pass 3: adversarial tests

Run two-organization tests for read, write, relationship, retrieval, session, and retry paths. Tests must attempt actual cross-tenant access; happy-path fixtures are insufficient.

### Pass 4: failure-path review

Exercise invalid token, expired invitation, disabled membership, suspended organization, disabled channel, failed ingestion, provider timeout, database rollback, and duplicate request paths.

### Pass 5: architecture scan

Run repository scans for:

```bash
rg -n '@leadpilot/db' apps/web
rg -n 'EventSource|text/event-stream|live=sse|streamIndex|continuationToken|ReadableStream' apps/web/src/features/chat apps/agent/src
rg -n 'TODO|FIXME|HACK|\.skip\(|describe\.skip|it\.skip|test\.skip' apps packages
rg -n 'console\.(log|debug)' apps packages
```

Expected: no direct web database imports; no production chat streaming machinery; no placeholders, skipped tests, or debug logs in changed production files.

### Pass 6: full verification

```bash
npm run typecheck
npm test
npm run build
npm run db:test:bootstrap
npm run test:isolation
```

Expected: all commands exit `0`. The final report must include duration, test counts, skipped-test count, and any warnings.

## Required completion report format

Each executor must produce:

```markdown
## Completion evidence

- Tasks completed: N/N
- Files created: ...
- Files modified: ...
- Targeted tests: command + pass count
- Package tests: command + pass count
- Typecheck: command + result
- Build: command + result
- Two-tenant isolation tests: command + pass count
- Skipped tests: 0
- Placeholder scan: clean
- Streaming scan: clean
- Direct web DB import scan: clean
- Known limitations: none, or an explicit blocking defect
```

A plan is not complete when the report says “mostly,” “except,” “follow-up,” or “not tested.” Such output returns the task to implementation.
