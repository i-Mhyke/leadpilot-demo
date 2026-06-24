# Knowledge and Assistant Control Plane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each organization isolated services, assistant versions, knowledge ingestion, explicit reference grants, preview, publication, rollback, and provenance-preserving retrieval.

**Architecture:** NestJS owns configuration and ingestion commands. PostgreSQL-backed workers claim idempotent ingestion jobs. Flue later consumes only published configuration and server-scoped retrieval ports.

**Tech Stack:** NestJS, PostgreSQL, pgvector, Valibot, existing RAG packages, OpenAI embeddings adapter, Vitest.

---

### Task 1: Add business configuration and knowledge schema

**Files:**
- Create: `packages/db/migrations/004_business_configuration.sql`
- Create: `packages/db/migrations/005_knowledge.sql`
- Create: `packages/db/migrations/006_business_knowledge_rls.sql`
- Test: `packages/db/tests/integration/business-knowledge-schema.test.ts`
- Test: `packages/db/tests/integration/business-knowledge-isolation.test.ts`

- [ ] Write failing tests for organization profiles, services, service intake rules, assistant version uniqueness, channel slugs, source/version state, source-service ownership, chunk ownership, one published version, reference grants, and vector dimensions.
- [ ] Constrain V1 organization, assistant, source, and chunk language to `en`; tests must reject unsupported language tags instead of silently translating.
- [ ] Create the tables named in specification sections 8 and 9 with `organization_id NOT NULL` and `UNIQUE (id, organization_id)`.
- [ ] Use composite foreign keys for service rules, source-service links, versions, chunks, jobs, assistant versions, and channels.
- [ ] Put platform reference collections/versions/chunks in separate non-tenant tables; require `organization_reference_grants` for tenant use.
- [ ] Enable and force RLS on every organization-owned table and grant only scoped operations.
- [ ] Run isolation tests A→B and B→A for every table family; require PASS.
- [ ] Commit with `feat(db): add isolated business knowledge schema`.

### Task 2: Implement organization profile and service use cases

**Files:**
- Create: `packages/contracts/src/business-profile.ts`
- Create: `packages/contracts/src/services.ts`
- Create: `packages/domain/src/intake-rules.ts`
- Create: `packages/application/src/business-profile/get-business-profile.ts`
- Create: `packages/application/src/business-profile/update-business-profile.ts`
- Create: `packages/application/src/services/list-services.ts`
- Create: `packages/application/src/services/create-service.ts`
- Create: `packages/application/src/services/update-service.ts`
- Create: `packages/application/src/services/deactivate-service.ts`
- Create: `packages/db/src/tenant/business-profile.repository.ts`
- Create: `packages/db/src/tenant/service.repository.ts`
- Create: `apps/api/src/business-profile/business-profile.module.ts`
- Create: `apps/api/src/business-profile/business-profile.controller.ts`
- Create: `apps/api/src/services/services.module.ts`
- Create: `apps/api/src/services/services.controller.ts`
- Test: `packages/domain/src/intake-rules.test.ts`
- Test: `packages/application/src/business-profile/get-business-profile.test.ts`
- Test: `packages/application/src/business-profile/update-business-profile.test.ts`
- Test: `packages/application/src/services/list-services.test.ts`
- Test: `packages/application/src/services/create-service.test.ts`
- Test: `packages/application/src/services/update-service.test.ts`
- Test: `packages/application/src/services/deactivate-service.test.ts`
- Test: `packages/db/tests/integration/business-profile.repository.integration.test.ts`
- Test: `packages/db/tests/integration/service.repository.integration.test.ts`
- Test: `apps/api/test/business-profile.e2e.test.ts`
- Test: `apps/api/test/services.e2e.test.ts`

- [ ] Test strict service slug, active state, qualifying question order, urgency signals, required-document labels, fee visibility, and booking eligibility.
- [ ] Test one organization cannot read/update another service even when its UUID is supplied.
- [ ] Implement ports/use cases first, then scoped repositories, then thin Nest controllers.
- [ ] Require owner/admin for mutation; permit viewer/staff read where appropriate.
- [ ] Append safe audit events for every mutation.
- [ ] Run all targeted suites and commit with `feat(api): manage organization services`.

### Task 3: Implement assistant version lifecycle

**Files:**
- Create: `packages/contracts/src/assistant.ts`
- Create: `packages/domain/src/assistant-version.ts`
- Create: `packages/application/src/assistants/create-assistant-draft.ts`
- Create: `packages/application/src/assistants/publish-assistant-version.ts`
- Create: `packages/db/src/tenant/assistant.repository.ts`
- Create: `apps/api/src/assistants/assistants.module.ts`
- Create: `apps/api/src/assistants/assistants.controller.ts`
- Test: `packages/domain/src/assistant-version.test.ts`
- Test: `packages/application/src/assistants/create-assistant-draft.test.ts`
- Test: `packages/application/src/assistants/publish-assistant-version.test.ts`
- Test: `packages/db/tests/integration/assistant.repository.integration.test.ts`
- Test: `apps/api/test/assistants.e2e.test.ts`

- [ ] Test immutable versions, one published version, atomic replacement, rollback, forbidden direct status update, and organization isolation.
- [ ] Model statuses as `draft`, `published`, `archived`; publication obtains an advisory lock on organization/assistant identity.
- [ ] Store structured tone, greeting, fallback, escalation, compliance boundaries, and model configuration; do not store a single unvalidated prompt blob as the source of truth.
- [ ] Add publish audit metadata without raw prompt or knowledge contents.
- [ ] Verify and commit with `feat(assistant): add versioned configuration`.

### Task 4: Define ingestion ports and state machine

**Files:**
- Create: `packages/contracts/src/knowledge.ts`
- Create: `packages/domain/src/knowledge-ingestion.ts`
- Create: `packages/application/src/knowledge/ports.ts`
- Create: `packages/application/src/knowledge/create-source.ts`
- Create: `packages/application/src/knowledge/enqueue-ingestion.ts`
- Test: `packages/domain/src/knowledge-ingestion.test.ts`
- Test: `packages/application/src/knowledge/create-source.test.ts`
- Test: `packages/application/src/knowledge/enqueue-ingestion.test.ts`

- [ ] Test every allowed transition: `queued → extracting → validating → chunking → embedding → ready`; any processing state may enter `failed`; queued may enter `cancelled`; terminal states cannot move without an explicit retry command.
- [ ] Define stable error codes for unsupported type, size limit, fetch blocked, extraction empty, extraction corrupt, chunk failure, embedding failure, fingerprint mismatch, and cancelled.
- [ ] Define ports for object storage, website fetch, document extraction, embeddings, clock, job repository, and source repository.
- [ ] Ensure user-facing error fields exclude stack, raw provider response, storage key, SQL, and source content.
- [ ] Run tests and commit with `feat(knowledge): define ingestion lifecycle`.

### Task 4A: Implement hosted-channel configuration lifecycle

**Files:**
- Create: `packages/contracts/src/channels.ts`
- Create: `packages/domain/src/channel.ts`
- Create: `packages/application/src/channels/create-channel-draft.ts`
- Create: `packages/application/src/channels/update-channel-draft.ts`
- Create: `packages/application/src/channels/publish-channel.ts`
- Create: `packages/application/src/channels/disable-channel.ts`
- Create: `packages/db/src/tenant/channel.repository.ts`
- Create: `apps/api/src/channels/channels.module.ts`
- Create: `apps/api/src/channels/channels.controller.ts`
- Test: `packages/domain/src/channel.test.ts`
- Test: `packages/db/tests/integration/channel.repository.integration.test.ts`
- Test: `apps/api/test/channels.e2e.test.ts`

- [ ] Test globally unique public slug, one organization ownership, draft/published/disabled lifecycle, disabled organization denial, and safe presentation overrides.
- [ ] Restrict mutation to owner/admin and append audit events.
- [ ] Publish only when a published assistant exists and required profile fields are complete.
- [ ] Verify and commit with `feat(channels): manage hosted intake publication`.

### Task 5: Implement safe source adapters

**Files:**
- Create: `packages/firm-rag/src/sources/manual-source.ts`
- Create: `packages/firm-rag/src/sources/text-file-source.ts`
- Create: `packages/firm-rag/src/sources/pdf-source.ts`
- Create: `packages/firm-rag/src/sources/docx-source.ts`
- Create: `packages/firm-rag/src/sources/website-source.ts`
- Create: `packages/firm-rag/src/sources/url-safety.ts`
- Test: `packages/firm-rag/src/sources/manual-source.test.ts`
- Test: `packages/firm-rag/src/sources/text-file-source.test.ts`
- Test: `packages/firm-rag/src/sources/pdf-source.test.ts`
- Test: `packages/firm-rag/src/sources/docx-source.test.ts`
- Test: `packages/firm-rag/src/sources/website-source.test.ts`
- Test: `packages/firm-rag/src/sources/url-safety.test.ts`

- [ ] Before adding PDF/DOCX dependencies, run `npm view pdf-parse version` and `npm view mammoth version`; install the returned current versions exactly and commit the lockfile.
- [ ] Test text size limits, MIME/signature mismatch, password-protected/corrupt PDF, empty extraction, DOCX failure, redirect limits, request timeout, response size, and unsupported encoding.
- [ ] For website sources, resolve DNS before every request/redirect and reject loopback, link-local, private, multicast, and metadata IP ranges for IPv4 and IPv6.
- [ ] Normalize extracted content without silently dropping headings; report extraction character count and warnings.
- [ ] Run adapter tests without network by injecting DNS/fetch fakes; require PASS.
- [ ] Commit with `feat(knowledge): add safe source extractors`.

### Task 5A: Implement organization-scoped object storage

**Files:**
- Create: `apps/api/src/storage/storage.module.ts`
- Create: `apps/api/src/storage/s3-object-storage.adapter.ts`
- Create: `apps/api/src/storage/storage-key.ts`
- Test: `apps/api/src/storage/s3-object-storage.adapter.test.ts`
- Test: `apps/api/src/storage/storage-key.test.ts`

- [ ] Before coding, run `npm view @aws-sdk/client-s3 version`, install that exact version in `@leadpilot/api`, and commit the lockfile.
- [ ] Generate server-side keys as `organizations/<organizationId>/knowledge/<sourceId>/<versionId>/<randomObjectId>`; never accept a complete object key from the client.
- [ ] Test path traversal input, cross-organization delete/read, content length, content type, failed upload cleanup, and purge idempotency with an injected fake S3 client.
- [ ] Return storage handles only to application ports; API responses must not expose buckets, keys, or provider errors.
- [ ] Verify and commit with `feat(storage): isolate organization knowledge objects`.

### Task 6: Implement PostgreSQL-backed ingestion processing

**Files:**
- Create: `packages/db/src/tenant/knowledge.repository.ts`
- Create: `packages/db/src/worker/ingestion-job.repository.ts`
- Create: `packages/application/src/knowledge/process-ingestion-job.ts`
- Create: `apps/api/src/knowledge/knowledge.module.ts`
- Create: `apps/api/src/knowledge/ingestion.processor.ts`
- Test: `packages/application/src/knowledge/process-ingestion-job.test.ts`
- Test: `packages/db/tests/integration/knowledge.repository.integration.test.ts`
- Test: `packages/db/tests/integration/ingestion-job.repository.integration.test.ts`
- Test: `apps/api/src/knowledge/ingestion.processor.test.ts`

- [ ] Claim jobs with `FOR UPDATE SKIP LOCKED`, lease owner, lease expiry, and attempt count.
- [ ] For file sources, stream the validated upload through the object-storage port before enqueueing; on database failure delete the unreferenced object, and on upload failure create no source version.
- [ ] Apply multipart body, per-file, and extracted-text limits before buffering. Controllers may pass streams/metadata to the use case but may not parse documents themselves.
- [ ] Persist stage before external work and a fingerprint after each deterministic stage.
- [ ] Reuse existing chunking/embedding logic only after its inputs/outputs match the new ports; do not retain firm IDs or direct SQL dependencies.
- [ ] Replace chunks transactionally for the draft version; validate expected count, index continuity, embedding model, and dimensions before `ready`.
- [ ] Test two workers cannot process the same lease, expired leases recover, provider failure records a safe error, and retry does not duplicate versions/chunks.
- [ ] Run tests and commit with `feat(knowledge): process ingestion jobs safely`.

### Task 7: Implement publish, rollback, grants, and retrieval

**Files:**
- Create: `packages/application/src/knowledge/publish-knowledge-version.ts`
- Create: `packages/application/src/knowledge/rollback-knowledge-source.ts`
- Create: `packages/application/src/knowledge/search-organization-knowledge.ts`
- Create: `packages/db/src/tenant/knowledge-search.repository.ts`
- Create: `apps/api/src/knowledge/knowledge.controller.ts`
- Create: `apps/api/src/reference-collections/reference-collections.module.ts`
- Create: `apps/api/src/reference-collections/reference-collections.controller.ts`
- Test: `packages/application/src/knowledge/publish-knowledge-version.test.ts`
- Test: `packages/application/src/knowledge/rollback-knowledge-source.test.ts`
- Test: `packages/application/src/knowledge/search-organization-knowledge.test.ts`
- Test: `packages/db/tests/integration/knowledge-search.repository.integration.test.ts`
- Test: `apps/api/test/knowledge.e2e.test.ts`
- Test: `apps/api/test/reference-collections.e2e.test.ts`

- [ ] Test draft/failed versions cannot publish; publication is atomic; rollback restores an archived fingerprint; ungranted references return nothing.
- [ ] Test semantic and lexical searches always filter private chunks through RLS and references through explicit grants.
- [ ] Return evidence with source/version/hash/effective date/service tags and safe display label.
- [ ] Never accept organization ID, chunk ID, namespace, or arbitrary reference collection ID from the model-facing search input.
- [ ] Run real pgvector A/B isolation tests and commit with `feat(knowledge): publish and retrieve isolated evidence`.

### Task 8: Add managed preview without building a second environment

**Files:**
- Create: `packages/application/src/assistants/create-preview-context.ts`
- Create: `apps/api/src/preview/preview.controller.ts`
- Create: `apps/api/src/preview/preview.module.ts`
- Test: `packages/application/src/assistants/create-preview-context.test.ts`
- Test: `apps/api/test/preview.e2e.test.ts`

- [ ] Test only owner/admin/superadmin can preview; preview may select draft assistant/ready knowledge; preview cannot create leads, notifications, production analytics, or booking requests.
- [ ] Return a short-lived preview credential with explicit `mode: preview` and selected version IDs.
- [ ] Audit start/end without conversation content.
- [ ] Verify and commit with `feat(preview): add managed draft preview`.

### Task 9: Knowledge completion audit

**Files:**
- Create: `docs/superpowers/plans/multi-tenant-plans/evidence/04-knowledge-isolation.md`
- Create: `docs/superpowers/plans/multi-tenant-plans/evidence/04-ingestion-errors.md`
- Create: `docs/superpowers/plans/multi-tenant-plans/evidence/04-retrieval-provenance.md`

- [ ] Build a two-organization fixture with identical source names and different unique marker text.
- [ ] Execute lexical and vector queries designed to retrieve the other marker; require zero leakage.
- [ ] Test every ingestion error code appears safely through the API.
- [ ] Verify no failed/draft chunk is searchable.
- [ ] Verify publication and rollback under concurrent requests.
- [ ] Save the A→B/B→A matrix in `04-knowledge-isolation.md`, every public error code/status/remediation in `04-ingestion-errors.md`, and source/version/hash/grant evidence in `04-retrieval-provenance.md`.
- [ ] Run contracts/domain/application/db/api/RAG tests and typechecks; produce the completion report.
