# LeadPilot Multitenant Platform Design

**Status:** Approved architecture design  
**Date:** 2026-06-23  
**Implementation target:** A fresh PostgreSQL database with a clean migration history  
**First delivery milestone:** Tenant and knowledge spine

## 1. Objective

LeadPilot is a managed, multitenant AI intake workspace for service businesses. Each organization configures its business profile, services, knowledge, assistant, hosted intake channel, and lead workflow. The assistant answers supported questions, captures enquiries, qualifies leads, creates booking requests, summarizes conversations, and recommends staff actions.

The immediate objective is to build a security spine that prevents private data from crossing organization boundaries while supporting organization-specific knowledge ingestion and retrieval. The system must remain capable of placing selected organizations in dedicated databases later without rewriting business logic.

The core product journey is:

> Visitor asks a question → assistant answers from permitted evidence → assistant collects details → lead is created and qualified → booking is requested → staff follows up → lead converts or becomes dormant.

## 2. Scope

### Milestone 1: tenant and knowledge spine

- Managed organization provisioning and first-owner invitation.
- External authentication identity with application-owned memberships and roles.
- Organization-aware database access, composite ownership constraints, and PostgreSQL RLS.
- Organization profile, service catalog, and layered intake rules.
- Versioned assistant configuration.
- Versioned private knowledge ingestion with visible failures, preview, publication, and rollback.
- Explicit grants to platform-reference collections.
- PostgreSQL/pgvector retrieval with strict organization filtering and provenance.
- One hosted intake channel.
- Server-issued visitor sessions and persisted Flue bindings.
- A dedicated NestJS control-plane API.
- TanStack server functions reduced to authenticated BFF adapters with no database access.
- Direct request/response chat between the hosted page and Flue using `?wait=result`.
- Isolation, ingestion, bootstrap, and latency verification.

### Milestone 2: lead operating layer

- Contact, conversation, and lead restructuring.
- Conversation inbox and transcript.
- Lead list, detail view, and configurable pipeline.
- Append-only AI assessments and staff-authoritative operational state.
- Booking-request queue.
- Manual follow-up tasks.
- Manual lead assignment.
- Idempotent email notifications.

### Explicitly outside V1

- WhatsApp and website widget channels.
- Live calendar availability or automatic booking confirmation.
- Visitor document uploads.
- Multilingual behavior; V1 is English-only.
- Custom roles, departments, or broader employee management.
- Automated lead assignment and workload balancing.
- Automated reactivation, invoices, payments, advanced analytics, and CRM integrations.
- Per-organization data residency.
- Full multi-database deployment; only the placement boundary is included.
- Token-by-token text streaming, SSE chat recovery, stream cursors, and event-stream UI state.

### Frontend design mandate

All workspace and dashboard implementation must explicitly use both local skills before editing UI:

- `/Users/mac/.agents/skills/design-taste-frontend/SKILL.md`
- `/Users/mac/taste-skill/skills/soft-skill/SKILL.md`

The fixed LeadPilot direction is **Soft Structuralism + Asymmetrical Bento** with design variance `8`, motion intensity `6`, and visual density `4`. The system uses Geist/Geist Mono, off-white and charcoal neutrals, one restrained teal accent, Phosphor icons at one consistent weight, asymmetric desktop grids, and strict single-column mobile collapse. Purple/blue AI gradients, pure black, Inter, generic equal-card rows, harsh shadows, excessive card boxing, emojis, and unverified UI dependencies are prohibited.

Major elevated operational surfaces use restrained double-bezel construction; ordinary data grouping uses whitespace, separators, and typographic hierarchy. Every feature must implement layout-matched skeletons, useful empty states, inline errors, permission states, stale-write/conflict states, keyboard/focus behavior, reduced-motion behavior, and responsive layouts. Motion uses transform/opacity only, is isolated to interactive leaves, and must not reintroduce chat text streaming.

## 3. Runtime topology

The monorepo contains three deployable applications with separate responsibilities:

- `apps/web` — TanStack Start UI, SSR, route loaders, and thin backend-for-frontend server functions. It must not import `@leadpilot/db`, open database connections, or establish tenant authorization independently.
- `apps/api` — NestJS control plane for staff authentication, organization membership, provisioning, configuration, knowledge administration, lead operations, audit, and intake-session issuance.
- `apps/agent` — Flue conversation data plane. It validates signed intake credentials, resolves opaque bindings, runs the assistant, performs retrieval, persists conversation turns, and emits asynchronous outbox work.

Reusable business behavior lives outside framework applications:

- `packages/contracts` — transport schemas and DTOs shared by web, API, and agent.
- `packages/domain` — pure domain rules and state transitions.
- `packages/application` — use cases and ports that do not import NestJS, TanStack, or Flue.
- `packages/db` — PostgreSQL migrations, RLS transaction boundary, and scoped repository implementations.
- RAG packages — extraction, chunking, embedding, and retrieval behavior composed through application ports.

NestJS is not placed in the live conversation hot path. The hosted page makes a one-time intake-session request to `apps/api`, then sends each message directly to the guarded Flue agent endpoint and waits for one complete JSON response. Lead and notification processing happens asynchronously through an outbox so it does not delay the visitor response.

## 4. Architectural invariants

These rules are mandatory and take precedence over convenience:

1. `organization` is the permanent tenant and security boundary.
2. “Workspace” is a product-facing name, not a second persistence hierarchy in V1.
3. Every private operational row has a non-null `organization_id`.
4. Every relationship between tenant-owned rows proves common ownership through composite constraints.
5. A missing organization context denies access; it never broadens access.
6. Public slugs, route parameters, model inputs, browser identifiers, and Flue instance IDs are not authorization.
7. Organization context is established by the server and cannot be selected or overridden by the model.
8. In-memory state may accelerate resolution but is never the security authority.
9. Draft, failed, or partially processed knowledge is never available to a live assistant.
10. Organization-contributed knowledge is never shared with another organization.
11. Only platform-curated reference collections may be shared, and only through explicit grants.
12. AI assessments are suggestions with evidence and confidence; staff controls operational state.
13. Retried or recovered Flue work must not duplicate external side effects.
14. A fresh database must be reproducible from zero using the active migration history.
15. TanStack server functions never import or call the database package.
16. Live chat uses request/response completion only; no product code depends on Flue event streams, SSE, stream offsets, or token-by-token rendering.
17. NestJS is the staff and configuration control plane, not a synchronous proxy for each chat turn.
18. Dashboard UI changes cannot be accepted without applying both named design skills and passing visual, responsive, accessibility, interaction-state, and reduced-motion review gates.

## 5. Trust boundaries

Every request enters through exactly one trust path.

### 5.1 Staff path

An external OIDC system verifies identity and supplies an immutable subject through Authorization Code + PKCE. NestJS exchanges that identity for an opaque, hashed LeadPilot application session stored only in an HttpOnly cookie. LeadPilot resolves the current application user and active organization membership from PostgreSQL on protected requests. The requested workspace slug may select among authorized memberships but cannot create authorization.

Roles are predefined:

- `owner`: full organization control, destructive actions, and membership administration.
- `admin`: services, knowledge, assistant, channels, pipeline, and staff operations.
- `staff`: conversations, leads, booking requests, and follow-up work.
- `viewer`: read-only operational access.

V1 team administration is limited to invitation, predefined role assignment, and deactivation.

### 5.2 Visitor path

A public request resolves a published hosted-channel record. The NestJS control plane creates an intake session and credential bound to exactly one organization, channel, conversation, and opaque Flue instance. Client-generated browser IDs may support local UI continuity but cannot grant transcript or conversation access.

### 5.3 Worker path

Background ingestion, analysis, and notification workers use a trusted service identity plus explicit organization scope. Jobs persist that scope before execution so retries and recovery do not depend on request headers or process memory.

### 5.4 Platform path

The only V1 platform role is `superadmin`. It is not an organization membership role. Its capabilities are limited to organization provisioning, initial configuration, and issuing the first owner invitation. It has no default access to leads, conversations, or visitor PII.

## 6. Tenant-aware data access

All business repositories receive an immutable `OrganizationDataContext`:

```ts
interface OrganizationDataContext {
  organizationId: string;
  placementKey: string;
  actor: StaffActor | VisitorActor | WorkerActor;
  correlationId: string;
}
```

The database resolver maps `placementKey` to a database connection. Every organization maps to the shared database in V1. A future dedicated organization can map to another connection without changing repository behavior.

Feature code must not import a raw SQL client. A `withOrganizationContext(...)` boundary opens a transaction, sets the tenant context using `SET LOCAL`, and executes repository operations on that same connection. If the current Neon HTTP client cannot guarantee transaction affinity for this boundary, the adapter must use a connection mechanism that can; RLS must not be weakened to accommodate a client limitation.

## 7. PostgreSQL isolation model

### 7.1 Ownership constraints

Every tenant-owned table has:

- `organization_id uuid NOT NULL`.
- `UNIQUE (id, organization_id)`.
- Composite foreign keys such as `(conversation_id, organization_id)` rather than independent references to an ID and organization.

This prevents rows from claiming one organization while pointing at a parent from another organization.

### 7.2 Row-Level Security

RLS is enabled and forced on private tables for runtime roles. Policies compare `organization_id` with a transaction-local organization setting. No setting or an invalid setting produces no access or an explicit failure.

Database roles are separated:

- Migration role: extensions, schema, migrations, and policy management.
- Tenant runtime role: RLS-enforced operational access.
- Worker role: RLS-enforced access with explicit job organization context.
- Provisioning role: organization, invitation, initial configuration, and audit operations only.

Platform-reference tables are not tenant-owned. Access to their content is mediated through an explicit organization grant and tenant-scoped retrieval functions.

## 8. Core schema

### 8.1 Platform and identity

- `organizations`: identity, lifecycle, country, timezone, deployment region, and status.
- `users`: application user linked to an external authentication subject.
- `auth_login_attempts`: short-lived state, nonce, and PKCE exchange records.
- `user_sessions`: hashed opaque application sessions with expiry and revocation.
- `organization_memberships`: user, organization, role, and membership status.
- `organization_invitations`: hashed single-use token, intended role, expiry, acceptance, and issuer.
- `organization_data_placements`: organization-to-database placement mapping.
- `platform_operators`: minimal platform role assignment.
- `audit_events`: append-only actor, organization, action, target, correlation, and safe change metadata.

Authentication provider credentials remain outside application authorization tables. The initial provider adapter must return a stable subject and verified email; application roles and tenant access remain in LeadPilot.

### 8.2 Business configuration

- `organization_profiles`: business details, operating hours, default disclaimers, global intake rules, and branding basics.
- `services`: structured organization offerings.
- `service_intake_rules`: qualifying questions, urgency signals, fit criteria, required-document checklist, fee guidance, and booking eligibility.
- `assistant_versions`: immutable configuration versions with draft, published, and archived states.
- `channels`: hosted-page slug/domain, type, state, presentation overrides, and publication state.

One organization has one published assistant in V1. All active channels use that assistant; channel overrides are limited to presentation such as greeting and message length.

### 8.3 Lead operating layer

- `contacts`: organization-owned person or company identity.
- `contact_methods`: verified email or phone values; matching never crosses organizations.
- `intake_sessions`: hashed visitor credential, organization, channel, conversation, expiry, and revocation.
- `agent_instance_bindings`: opaque Flue instance to organization, channel, conversation, and configuration version.
- `conversations` and `conversation_messages`: channel interaction history.
- `leads`: one service enquiry or opportunity.
- `lead_conversations`: permits multiple conversations per lead while constraining a conversation to one active lead.
- `lead_assessments`: append-only AI extraction, summary, urgency, fit, score, missing information, confidence, and evidence references.
- `pipeline_stages`: organization-defined stages mapped to stable system categories.
- `lead_stage_events`: append-only pipeline transitions.
- `follow_up_tasks`: manual work, owner, due date, and status.
- `booking_requests`: preferred time, service, contact, notes, and staff-controlled status.

Contacts may have multiple leads. Contact association uses verified email or phone within the organization; a name alone never triggers automatic merging.

## 9. Knowledge architecture

Private and platform knowledge use separate table families so private ownership is never nullable or ambiguous.

### 9.1 Organization-private knowledge

- `knowledge_sources`: stable logical source with type `manual`, `faq`, `website`, or `file`.
- `knowledge_source_services`: many-to-many links to organization services.
- `knowledge_versions`: immutable extracted content, content hash, language, lifecycle, and source metadata.
- `knowledge_chunks`: version, sequence, content, heading path, token estimate, provenance, embedding fingerprint, and pgvector embedding.
- `knowledge_ingestion_jobs`: job lifecycle, stage, error code, safe explanation, remediation, retryability, and correlation.

Only one version per source may be published. Publishing is atomic and leaves the previous version available for rollback. Organization-wide sources may have no service link. Service-linked sources are narrowed or boosted when the active service is known.

### 9.2 Platform-reference knowledge

- `reference_collections`: platform-curated corpus identity and applicability.
- `reference_versions` and `reference_chunks`: immutable published reference material.
- `organization_reference_grants`: explicit permission for an organization to retrieve a collection.

Organizations never edit shared reference records. Editable templates are copied into organization-private sources.

### 9.3 Supported V1 inputs

- Structured business and service forms.
- Manual FAQs and policy notes.
- Website page import.
- Text-based PDF, DOCX, Markdown, and plain text.

Scanned PDFs, images, spreadsheets, inboxes, and cloud-drive synchronization are rejected as unsupported in V1. Extraction failures are visible and never silently publish incomplete content.

## 10. Knowledge ingestion lifecycle

Ingestion is asynchronous and idempotent:

1. Resolve organization context and validate source ownership.
2. Validate source type and size.
3. Store the original file or fetched representation.
4. Create an immutable version and job.
5. Extract and normalize text.
6. Validate extraction completeness and quality.
7. Chunk and attach service and provenance metadata.
8. Generate embeddings and verify model, dimensions, counts, and fingerprints.
9. Mark the version `ready_for_review`.
10. Permit managed preview.
11. Publish atomically after explicit approval.

Job states are `queued`, `extracting`, `validating`, `chunking`, `embedding`, `ready`, `failed`, and `cancelled`.

Failures store:

- Stable error code.
- Failed stage.
- Safe user-facing explanation.
- Remediation guidance.
- Retryability.
- Correlation ID and timestamps.
- Internal technical detail unavailable to tenant users.

Retries reuse idempotency keys. A failed replacement leaves the existing published version live.

## 11. Retrieval and provenance

Embeddings remain in PostgreSQL using pgvector. Private chunks are protected by the same RLS and ownership constraints as their sources.

The model-callable retrieval tool accepts only safe inputs such as query, optional service hint, requested scope (`private`, `reference`, or `both`), and result limit. It never accepts organization IDs, namespaces, document IDs, or corpus IDs.

The server determines the active organization and allowed collections. Retrieval uses lexical and semantic search over:

1. Published organization-private chunks.
2. Published platform-reference chunks from explicitly granted collections.

Every result retains source, version, content hash, effective date, service tags, and retrieval score. Retrieval logs record evidence IDs without leaking full private content into operational logs. Public citations use safe display labels and never expose internal filenames, storage keys, private URLs, or system paths.

When evidence cannot support a business-specific answer, the assistant states that it cannot confirm the answer, captures details, and creates a human follow-up or handoff. Platform references may provide general context but never professional advice.

## 12. Flue integration

The existing client-controlled `${firmSlug}/${browserSessionId}` agent identity and process-global binding map are not authoritative enough for multitenancy.

The non-streaming flow is:

1. The hosted page asks `apps/api` to resolve a published channel and create a session.
2. The API creates an organization-bound intake session, conversation, opaque Flue instance ID, and persisted binding.
3. The API issues a short-lived signed chat credential bound to the session and opaque instance; the raw organization ID is not a client-selected input.
4. The browser posts the message directly to `POST /agents/leadpilot/:instanceId?wait=result` on `apps/agent`.
5. Flue route middleware verifies signature, audience, expiry, session, and instance binding before prompt admission.
6. During agent initialization, the server resolves the persisted binding and published configuration.
7. Every tool closes over the immutable organization context and uses RLS-enforced repositories.
8. Flue returns one complete JSON response after the turn settles. The UI displays a submitted/loading state while waiting; it does not consume event streams or partial text.
9. Conversation persistence is part of the guarded turn lifecycle, not a follow-up write initiated by the browser.
10. Structured lead analysis and notifications are emitted to an idempotent outbox and processed asynchronously.

Flue initializes a root harness for each submitted turn. Tenant context therefore cannot depend on a one-time constructor or original HTTP headers. A short-lived in-memory cache may store resolved bindings and published configuration by version. Cold starts, retries, and another process reload from PostgreSQL. Cache invalidation occurs when an organization is suspended, a channel is disabled, or relevant configuration is published.

One batched context load should return the binding, organization status, channel, published assistant version, compact service catalog, and granted reference collection IDs. Tools reuse that resolved context throughout the turn.

Flue `?wait=result` is best-effort across process interruption. The application handles an interrupted HTTP wait as a retryable turn using a client-generated idempotency key. It does not fall back to event-stream consumption. The retry either returns the already persisted completed turn or safely resumes/replays without duplicating messages or side effects.

## 13. Public intake security

- Hosted pages resolve through `channels`, not organizations directly.
- The server issues an opaque intake credential bound to one organization, channel, and conversation.
- Credentials expire, can be revoked, and are stored hashed.
- The Flue prompt endpoint validates the signed credential before admitting a message.
- Event-stream reads are not part of the product protocol and must be rejected or left unexposed by deployment routing.
- The browser receives complete assistant responses only after `?wait=result` completes.
- Message submission and tool writes use idempotency keys.
- Rate limits apply by channel, session, and network signal.
- Hosted pages are same-origin in V1; permissive wildcard CORS is removed.
- Disabling a channel prevents new intake immediately.

## 14. Managed onboarding

The superadmin provisioning transaction creates:

- Organization and profile.
- Shared-database placement.
- Default pipeline stages.
- Initial assistant draft.
- Hosted-channel draft.
- Audit event.

The system then issues a hashed, expiring, single-use first-owner invitation. The owner authenticates with the external provider and accepts the invitation to create an `owner` membership. The superadmin never creates or knows the password.

## 15. Assistant lifecycle

Assistant configuration is immutable and versioned. Draft configuration can be tested by the superadmin through a lightweight preview mode. Live channels continue using the last published version until an explicit publish action.

Preview runs:

- May select draft assistant and knowledge versions.
- Are clearly marked as tests.
- Do not create production leads.
- Do not affect production metrics.
- Do not send notifications.

At live turn initialization, the prompt receives only compact organization profile, published assistant settings, active services, and channel overrides. Detailed knowledge stays behind retrieval tools.

## 16. Lead operations

Every conversation is persisted, but greetings, spam, unsupported questions, and tests do not automatically become leads. Post-turn analysis proposes structured intent, service, urgency, fit, completeness, summary, missing information, confidence, and recommended action.

When the approved threshold is met, the system creates a lead and links the conversation. Staff may manually promote or dismiss conversations. AI writes append-only assessments; it does not silently overwrite stage, assignment, disposition, or booking status.

Pipeline labels are configurable per organization but map to stable categories: `new`, `qualified`, `booked`, `won`, `lost`, and `dormant`.

Leads enter unassigned and are manually assigned. Booking requests remain pending until staff confirms or reschedules them. V1 email notifications are limited to qualified leads, urgent enquiries or handoffs, booking requests, and overdue follow-ups.

## 17. Error handling and observability

Operational logs contain correlation and organization IDs but exclude:

- Conversation bodies.
- Contact details.
- Document contents.
- Credentials and tokens.
- Raw model prompts containing private data.

Tenant-isolation failures are security events. Organization-visible errors provide safe explanations and remediation. Internal diagnostics remain behind a correlation ID.

Audit events are append-only and cover authentication, memberships, organization configuration, knowledge ingestion and publication, assistant and channel publication, pipeline changes, lead assignment and stage changes, booking decisions, exports, suspension, and deletion.

## 18. Organization lifecycle

Organization state follows:

`active → suspended → deletion_pending → purged`

- Suspension immediately disables channels and staff operations without deleting data.
- Owner-confirmed deletion begins a 30-day recovery period.
- Purging removes organization-owned rows, stored files, knowledge versions, chunks, embeddings, sessions, and derived active-system data.
- Backups age out according to the documented backup-retention schedule.

V1 uses one documented deployment region and makes no custom data-residency guarantee.

## 19. Verification strategy

Isolation tests run against real PostgreSQL with at least two organizations. They prove:

- Cross-organization reads return no rows.
- Cross-organization writes fail.
- Mixed-ownership foreign keys fail.
- RLS denies absent tenant context.
- Private lexical and vector search never returns another organization’s chunks.
- Reference content requires an explicit grant.
- Session credentials cannot access another conversation or Flue instance.
- Suspended organizations and disabled channels are blocked.
- Runtime roles cannot bypass RLS.

Additional integration tests cover:

- Fresh database migration from zero.
- Invitation expiry, single use, and role enforcement.
- Ingestion failures and transparent error states.
- Atomic publication and rollback.
- Draft-preview separation.
- Contact matching within organization boundaries.
- AI versus staff field ownership.
- Flue retry idempotency for messages, leads, booking requests, and notifications.
- Organization suspension and deletion lifecycle.
- An architectural import test proving `apps/web` cannot import `@leadpilot/db`.
- A source scan proving production chat code contains no SSE, event-stream reads, stream cursors, or token-stream state.

Latency tests compare cold context resolution, warm cached turns, retrieval, and complete request/response duration. They separately measure the one-time NestJS intake-session call and prove NestJS is not invoked synchronously for each chat turn. The cache is considered correct only when disabling it changes performance but not security or behavior.

## 20. Fresh-database migration strategy

The newly provisioned PostgreSQL database is authoritative. The current database contains no production data and will not be migrated.

The active `packages/db/migrations` history will be replaced with an organization-first history that is reproducible from zero. Existing firm-centric files may be moved to a non-executable `packages/db/migrations_legacy` reference directory during the rewrite; the migration runner must not discover that directory. After an environment begins using the new history, applied migrations are immutable and all changes use new migration files.

The initial migration groups are:

1. Extensions, platform identities, organizations, invitations, placement, and audit.
2. Business profile, services, intake rules, assistant versions, and channels.
3. Knowledge sources, versions, jobs, chunks, pgvector indexes, reference collections, and grants.
4. Intake sessions and persisted Flue bindings.
5. Composite ownership constraints, database roles, RLS policies, and scoped functions.
6. Milestone-two contacts, conversations, leads, pipeline, tasks, and booking requests.

Seed data is separate from schema migrations and idempotently creates managed templates or local demo organizations.

## 21. Delivery gates

Milestone 1 is complete only when:

- A superadmin can provision an organization and issue the first-owner invitation.
- An owner can activate and access only their organization.
- Organization profile, services, assistant, and hosted channel can be configured and published.
- Supported knowledge can be ingested, fail transparently, previewed, published, rolled back, and retrieved.
- A private retrieval attempt cannot return another organization’s content under direct query, malformed input, missing context, model tool use, or retry.
- A hosted visitor session cannot read or write another session, organization, conversation, or Flue instance.
- Chat messages travel directly from the hosted page to guarded Flue `?wait=result` endpoints without a synchronous NestJS proxy.
- No production chat code depends on SSE, token streaming, stream offsets, or event-stream recovery.
- TanStack server functions contain no direct database imports.
- The complete migration history succeeds against an empty database.
- Cross-tenant integration tests and latency checks pass.

Milestone 2 begins only after these gates pass.

## 22. Source-grounding notes

This design was grounded in the current application and local Flue source rather than assumed APIs.

Current LeadPilot references:

- `apps/agent/src/app.ts`: public chat dispatch currently accepts client firm context.
- `apps/agent/src/agents/leadpilot.ts`: agent ID parsing, profile injection, and tool construction.
- `apps/agent/src/agent/lib/persistence.ts`: process-global session binding map.
- `apps/agent/src/agent/lib/session-scope.ts`: current binding resolution.
- `apps/agent/src/tools/search_knowledge.ts`: firm ID is currently closed over after binding.
- `apps/web/src/features/dashboard/server.ts`: dashboard reads currently authorize only through firm slug.
- `apps/web/src/features/chat/flue-session.ts`: current `?wait=result` request/response precedent.
- `apps/web/src/features/chat/eve-session.ts` and cursor/recovery files: legacy streaming complexity to remove from production chat paths.
- `packages/db/src/client.ts`: shared Neon query client.
- `packages/db/src/firm-ownership.ts`: current application-level ownership checks.
- `packages/db/src/firm-knowledge.ts`: organization-filtered lexical/vector retrieval precedent.
- `packages/db/migrations/001_firm_instance.sql` through `011_fix_idempotency_unique_indexes.sql`: current firm-centric schema and idempotency work.
- `packages/db/migrations/009_firm_knowledge_base.sql`: existing versioned document/chunk and composite knowledge ownership precedent.

Local Flue references:

- `source_context/flue/packages/runtime/src/agent-definition.ts`: `defineAgent()` initializer contract and lifecycle warning.
- `source_context/flue/packages/runtime/src/client.ts`: `initializeRootHarness()` invokes the initializer.
- `source_context/flue/packages/runtime/src/runtime/agent-submissions.ts`: each submitted turn opens a session and initializes a root harness.
- `source_context/flue/packages/runtime/src/types.ts`: durable processing may not retain original request headers and tools are supplied through runtime configuration.
- `source_context/flue/packages/runtime/src/runtime/handle-agent.ts`: direct prompt support for synchronous `?wait=result` responses.
- `source_context/flue/packages/sdk/src/types.ts`: complete `AgentPromptResponse` contract.

Postiz was inspected as an architectural reference, specifically its NestJS controller/service/repository organization, database-backed user resolution, organization membership model, middleware, guards, and request decorators. Its code is not a multitenancy security baseline: it has no PostgreSQL RLS or composite ownership model, relies primarily on application-level organization filters, exposes header/cookie organization selection, and contains no backend/database test files in the inspected tree. Postiz is AGPL-3.0 licensed, so LeadPilot will implement the useful patterns independently rather than copying source code.

The current CodeGraph MCP configuration could not be used because the configured `codegraph` executable is absent from the local PATH. `codegraph init -i` did not create an index. This does not change the design, but CodeGraph installation must be repaired separately before structural MCP queries are available in this workspace.
