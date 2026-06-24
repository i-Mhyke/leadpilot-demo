# Managed Identity and Provisioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Authenticate staff through a standards-based external identity, provision organizations as superadmin, and activate the first owner through a single-use invitation.

**Architecture:** NestJS performs an OIDC Authorization Code + PKCE exchange against a hosted identity provider and issues an opaque LeadPilot session cookie. Every protected request resolves fresh user/membership state from PostgreSQL; route organization selectors are validated against membership and converted into immutable request context.

**Tech Stack:** NestJS guards/decorators, `jose`, PostgreSQL, Valibot, Vitest, Supertest.

---

### Task 1: Define identity and provisioning contracts

**Files:**
- Create: `packages/contracts/src/auth.ts`
- Create: `packages/contracts/src/organizations.ts`
- Modify: `packages/contracts/src/index.ts`
- Test: `packages/contracts/src/auth.test.ts`
- Test: `packages/contracts/src/organizations.test.ts`

- [ ] Write failing tests for strict authenticated principal, organization creation, invitation acceptance, membership role, and safe organization response schemas.
- [ ] Require organization slug normalization, IANA timezone, non-empty business name, and owner email normalization.
- [ ] Reject client-supplied organization IDs, roles outside the fixed enum, lifecycle state, data placement, audit actor, and superadmin flags.
- [ ] Implement and export the schemas.
- [ ] Run `npm test -w @leadpilot/contracts && npm run typecheck -w @leadpilot/contracts`; require PASS.
- [ ] Commit with `feat(contracts): add identity and organization contracts`.

### Task 2: Add hosted OIDC login and opaque application sessions

**Files:**
- Create: `apps/api/src/auth/auth.module.ts`
- Create: `apps/api/src/auth/oidc.config.ts`
- Create: `apps/api/src/auth/oidc-token.verifier.ts`
- Create: `apps/api/src/auth/oidc-login.service.ts`
- Create: `apps/api/src/auth/auth.controller.ts`
- Create: `apps/api/src/auth/session-cookie.ts`
- Create: `apps/api/src/auth/auth-principal.ts`
- Create: `apps/api/src/auth/session-auth.guard.ts`
- Create: `apps/api/src/auth/current-principal.decorator.ts`
- Test: `apps/api/src/auth/oidc-token.verifier.test.ts`
- Test: `apps/api/src/auth/oidc-login.service.test.ts`
- Test: `apps/api/test/auth-session.e2e.test.ts`

- [ ] **Step 1: Test security failures before implementation**

Cover state mismatch, expired/reused login attempt, PKCE mismatch, token endpoint failure, malformed ID token, wrong issuer/audience, expired token, unverified email, missing subject, unknown key ID, valid callback, expired/revoked app session, and logout. Generate an ephemeral test keypair; do not put static private keys in fixtures.

- [ ] **Step 2: Implement a narrow principal**

```ts
export interface AuthPrincipal {
  subject: string;
  email: string;
  emailVerified: true;
}
```

Before coding, run `npm view jose version`, install that exact version in `@leadpilot/api`, and commit the lockfile. Use `createRemoteJWKSet()` and `jwtVerify()` with exact issuer, audience, algorithms, clock tolerance, nonce, and required `sub`, `email`, and `email_verified` claims. Cache only JWKS behavior; never cache organization membership in the identity token.

`GET /api/auth/login` creates state, nonce, and PKCE verifier, stores the short-lived login attempt, sets an HttpOnly/Secure/SameSite state cookie, and redirects to the configured authorization endpoint. `GET /api/auth/callback` atomically consumes the attempt, exchanges the code, verifies the ID token, resolves the application user, creates a random opaque `user_sessions` token hash, and sets the raw session only in an HttpOnly/Secure cookie. `POST /api/auth/logout` revokes the session and clears the cookie.

- [ ] **Step 3: Verify safe errors**

All invalid sessions return `401` problem details without disclosing whether a user or invitation exists. Never place OIDC tokens or the LeadPilot session token in response JSON, local storage, URLs, or logs.

- [ ] **Step 4: Verify and commit**

Run: `npm test -w @leadpilot/api -- --run src/auth/oidc-token.verifier.test.ts src/auth/oidc-login.service.test.ts test/auth-session.e2e.test.ts`  
Expected: PASS.

```bash
git add apps/api/src/auth apps/api/test/auth-session.e2e.test.ts apps/api/src/app.module.ts package-lock.json
git commit -m "feat(auth): add hosted OIDC sessions"
```

### Task 3: Resolve application users and memberships

**Files:**
- Create: `packages/application/src/identity/identity.port.ts`
- Create: `packages/application/src/identity/resolve-application-user.ts`
- Create: `packages/db/src/platform/user.repository.ts`
- Create: `packages/db/src/platform/membership.repository.ts`
- Create: `apps/api/src/auth/application-user.guard.ts`
- Create: `apps/api/src/auth/current-user.decorator.ts`
- Test: `packages/application/src/identity/resolve-application-user.test.ts`
- Test: `packages/db/tests/integration/user-membership.repository.integration.test.ts`
- Test: `apps/api/test/application-user-guard.e2e.test.ts`

- [ ] Test first login creates or links a user only by verified OIDC subject; matching email without an invitation must not grant membership. Test each protected request resolves the opaque session hash and current user state from PostgreSQL.
- [ ] Test disabled user and disabled membership denial.
- [ ] Test token claims cannot promote a user or choose an organization.
- [ ] Implement `ResolveApplicationUser` through a port and provisioning transaction.
- [ ] Re-query user status and memberships for each protected request; attach a typed application user without passwords or provider token claims.
- [ ] Run targeted tests, API tests, application tests, and typechecks; require PASS.
- [ ] Commit with `feat(auth): resolve database backed users`.

### Task 4: Add organization membership context and role guards

**Files:**
- Create: `apps/api/src/organizations/organization-context.guard.ts`
- Create: `apps/api/src/organizations/current-organization.decorator.ts`
- Create: `apps/api/src/organizations/require-role.decorator.ts`
- Create: `apps/api/src/organizations/role.guard.ts`
- Test: `apps/api/test/organization-context.e2e.test.ts`

- [ ] Write tests for authorized membership, wrong organization, suspended organization, inactive membership, viewer mutation, staff configuration mutation, and owner access.
- [ ] Resolve the organization selector from the route only after authentication; query membership by `(user_id, organization_id)`.
- [ ] Produce `OrganizationRequestContext` containing organization ID, user ID, role, correlation ID, and actor type.
- [ ] Do not use a `showorg` cookie/header, fallback to the first organization, `req.org` mutation with untyped casts, or Postiz-style impersonation.
- [ ] Verify every matrix case and commit with `feat(api): enforce organization membership context`.

### Task 5: Implement superadmin organization provisioning

**Files:**
- Create: `packages/application/src/organizations/provision-organization.ts`
- Create: `packages/application/src/organizations/provisioning.port.ts`
- Create: `apps/api/src/platform/superadmin.guard.ts`
- Create: `apps/api/src/platform/platform.module.ts`
- Create: `apps/api/src/platform/organizations.controller.ts`
- Test: `packages/application/src/organizations/provision-organization.test.ts`
- Test: `apps/api/test/provision-organization.e2e.test.ts`

- [ ] Test non-operator denial, duplicate slug, invalid timezone, rollback after partial seed failure, successful default placement, pipeline seed, assistant draft, channel draft, audit, and invitation creation.
- [ ] Implement one application use case that invokes one provisioning transaction; controllers contain no SQL and no seeding rules.
- [ ] Return the organization summary and a one-time invitation URL. Never return database credentials or store the raw invitation token.
- [ ] Store only `sha256(rawToken + INVITATION_PEPPER)` and a short expiry. Generate at least 256 bits of randomness.
- [ ] Run tests and verify transaction rollback leaves no organization row.
- [ ] Commit with `feat(platform): provision managed organizations`.

### Task 6: Implement first-owner invitation activation

**Files:**
- Create: `packages/application/src/invitations/accept-owner-invitation.ts`
- Create: `apps/api/src/invitations/invitations.module.ts`
- Create: `apps/api/src/invitations/invitations.controller.ts`
- Test: `packages/application/src/invitations/accept-owner-invitation.test.ts`
- Test: `packages/db/tests/integration/invitation-acceptance.integration.test.ts`
- Test: `apps/api/test/invitations.e2e.test.ts`

- [ ] Test valid acceptance, wrong authenticated email, expired token, consumed token, disabled organization, simultaneous double acceptance, and token enumeration-safe errors.
- [ ] Lock the invitation row during acceptance. In one transaction create/link the user, create owner membership, mark invitation consumed, and append audit.
- [ ] Ensure concurrent acceptance yields one membership and one success.
- [ ] Run integration tests twice and commit with `feat(auth): activate first organization owner`.

### Task 7: Implement organization suspension and deletion lifecycle

**Files:**
- Modify: `packages/contracts/src/organizations.ts`
- Create: `packages/application/src/organizations/suspend-organization.ts`
- Create: `packages/application/src/organizations/request-organization-deletion.ts`
- Create: `packages/application/src/organizations/cancel-organization-deletion.ts`
- Create: `packages/application/src/organizations/purge-organization.ts`
- Modify: `packages/db/src/platform/organization.repository.ts`
- Modify: `apps/api/src/platform/organizations.controller.ts`
- Test: `packages/application/src/organizations/organization-lifecycle.test.ts`
- Test: `packages/db/tests/integration/organization-lifecycle.integration.test.ts`
- Test: `apps/api/test/organization-lifecycle.e2e.test.ts`

- [ ] Test the exact `active → suspended → deletion_pending → purged` transitions, invalid reverse transitions, 30-day purge eligibility, owner cancellation during recovery, immediate channel/session denial after suspension, and audit events.
- [ ] Allow superadmin suspension and owner-confirmed deletion request. Require a second explicit owner confirmation value; never trigger deletion through a GET request.
- [ ] Make purge a worker-only command that verifies eligibility and deletes tenant rows/files through registered purge ports before marking the platform tombstone `purged`.
- [ ] Test purge rollback on object-storage failure and idempotent retry after partial external deletion.
- [ ] Run targeted tests and commit with `feat(organizations): enforce lifecycle and purge`.

### Task 8: Replace TanStack organization/auth database access with API calls

**Files:**
- Create: `apps/web/src/features/auth/auth-session.ts`
- Create: `apps/web/src/features/organizations/organization-actions.ts`
- Test: `apps/web/src/features/auth/auth-session.test.ts`
- Test: `apps/web/src/features/organizations/organization-actions.test.ts`
- Modify: `apps/web/src/routes/dashboard.tsx`
- Modify: `apps/web/src/routes/dashboard.$firmSlug.tsx`
- Test: `apps/web/src/routes/dashboard.test.tsx`
- Test: `apps/web/src/routes/dashboard.$firmSlug.test.tsx`

- [ ] Test the opaque HttpOnly application session is forwarded server-side and provider tokens never enter browser logs or local storage.
- [ ] Use `apiRequest()` for provisioning/activation endpoints.
- [ ] Map `401` to sign-in, `403` to access denied, and `404` to not found without exposing organization existence across memberships.
- [ ] Run web tests and typecheck; require PASS.
- [ ] Commit with `refactor(web): route organization access through API`.

### Task 9: Identity completion audit

**Files:**
- Create: `docs/superpowers/plans/multi-tenant-plans/evidence/03-auth-role-matrix.txt`
- Create: `docs/superpowers/plans/multi-tenant-plans/evidence/03-identity-completion.md`

- [ ] Execute the full role matrix as E2E tests.
- [ ] Inspect cookies/headers/logs and prove no raw OIDC or invitation token is logged.
- [ ] Attempt membership selection with another organization ID and slug.
- [ ] Attempt token claim manipulation for superadmin and role.
- [ ] Confirm no password fields/tables were added to LeadPilot authorization models.
- [ ] Run API/application/contracts/DB tests and typechecks.
- [ ] Save matrix output to `03-auth-role-matrix.txt`; produce `03-identity-completion.md` with exact commands, test counts, token/log inspection results, cross-organization attacks, and the final verdict.
