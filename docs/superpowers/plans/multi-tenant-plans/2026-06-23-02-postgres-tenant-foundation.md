# PostgreSQL Tenant Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the disposable firm-centric database history with a reproducible organization-first schema whose runtime access is constrained by composite ownership and forced RLS.

**Architecture:** PostgreSQL is the final tenant-security boundary. `withOrganizationContext()` owns one checked-out connection and transaction, sets transaction-local tenant and actor context, and passes a non-exportable scoped transaction to repositories.

**Tech Stack:** PostgreSQL, pgvector, node-postgres (`pg`), TypeScript, Vitest.

---

## File map

- Move current SQL to `packages/db/migrations_legacy/` as non-executable reference.
- Create a new active `packages/db/migrations/` history.
- Replace the global Neon tagged-query export with pool, migration, provisioning, and tenant-context modules.
- Add real-database tests under `packages/db/tests/integration/`.

### Task 1: Make database bootstrap destructive only for explicit test databases

**Files:**
- Create: `packages/db/src/config.ts`
- Create: `packages/db/tests/helpers/test-database.ts`
- Test: `packages/db/src/config.test.ts`
- Modify: `packages/db/scripts/migrate.ts`
- Modify: `packages/db/scripts/migrate.test.ts`
- Modify: `packages/db/package.json`

- [ ] **Step 1: Write failing configuration tests**

Test that configuration requires `DATABASE_URL`; that test reset rejects URLs whose database name does not end in `_test`; and that migration and runtime role URLs are distinct configuration fields.

- [ ] **Step 2: Run the tests**

Run: `npm test -w @leadpilot/db -- --run src/config.test.ts`  
Expected: FAIL because `readDatabaseConfig()` does not exist.

- [ ] **Step 3: Implement strict configuration**

```ts
export interface DatabaseConfig {
  migrationUrl: string;
  runtimeUrl: string;
  provisioningUrl: string;
  testUrl?: string;
}

export function assertDisposableTestDatabase(url: string): void {
  const name = new URL(url).pathname.slice(1);
  if (!name.endsWith('_test')) throw new Error('Refusing to reset a non-test database');
}
```

Do not log URLs. Add `db:test:bootstrap` and `test:isolation` scripts that require `TEST_DATABASE_URL`.

- [ ] **Step 4: Verify and commit**

Run: `npm test -w @leadpilot/db -- --run src/config.test.ts scripts/migrate.test.ts`  
Expected: PASS.

```bash
git add packages/db/src/config.ts packages/db/src/config.test.ts packages/db/tests/helpers packages/db/scripts packages/db/package.json
git commit -m "refactor(db): add safe database configuration"
```

### Task 2: Replace the active migration history

**Files:**
- Move: `packages/db/migrations/001_firm_instance.sql` → `packages/db/migrations_legacy/001_firm_instance.sql`
- Move: `packages/db/migrations/002_runtime_retrieval_logs.sql` → `packages/db/migrations_legacy/002_runtime_retrieval_logs.sql`
- Move: `packages/db/migrations/003_conversation_persistence.sql` → `packages/db/migrations_legacy/003_conversation_persistence.sql`
- Move: `packages/db/migrations/004_leads_and_booking_requests.sql` → `packages/db/migrations_legacy/004_leads_and_booking_requests.sql`
- Move: `packages/db/migrations/005_conversation_analytics.sql` → `packages/db/migrations_legacy/005_conversation_analytics.sql`
- Move: `packages/db/migrations/006_runtime_hardening.sql` → `packages/db/migrations_legacy/006_runtime_hardening.sql`
- Move: `packages/db/migrations/007_retrieval_log_text_ids.sql` → `packages/db/migrations_legacy/007_retrieval_log_text_ids.sql`
- Move: `packages/db/migrations/008_conversation_eve_stream_index.sql` → `packages/db/migrations_legacy/008_conversation_eve_stream_index.sql`
- Move: `packages/db/migrations/009_firm_knowledge_base.sql` → `packages/db/migrations_legacy/009_firm_knowledge_base.sql`
- Move: `packages/db/migrations/010_turn_write_idempotency.sql` → `packages/db/migrations_legacy/010_turn_write_idempotency.sql`
- Move: `packages/db/migrations/011_fix_idempotency_unique_indexes.sql` → `packages/db/migrations_legacy/011_fix_idempotency_unique_indexes.sql`
- Create: `packages/db/migrations/001_extensions_and_roles.sql`
- Modify: `packages/db/scripts/migrate.ts`
- Test: `packages/db/tests/integration/bootstrap.test.ts`

- [ ] **Step 1: Write the failing bootstrap test**

Reset the explicit test database, apply active migrations, and assert `pgcrypto`, `vector`, `app_migration`, `app_runtime`, `app_worker`, and `app_provisioning` exist. Run the migrator twice and require the second run to apply zero files.

- [ ] **Step 2: Verify failure**

Run: `npm run db:test:bootstrap -w @leadpilot/db`  
Expected: FAIL because the clean migration does not exist.

- [ ] **Step 3: Write the migration**

The migration must:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_migration') THEN
    CREATE ROLE app_migration NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_worker') THEN
    CREATE ROLE app_worker NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_provisioning') THEN
    CREATE ROLE app_provisioning NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
END $$;
```

Deployment login roles inherit one of these group roles outside source-controlled migrations. Never put passwords in SQL.

- [ ] **Step 4: Limit migration discovery**

Make the migrator read only `packages/db/migrations/*.sql`; assert in its unit test that `migrations_legacy` is ignored.

- [ ] **Step 5: Verify and commit**

Run: `npm run db:test:bootstrap -w @leadpilot/db`  
Expected: PASS twice with deterministic checksums.

```bash
git add packages/db/migrations packages/db/migrations_legacy packages/db/scripts packages/db/tests/integration/bootstrap.test.ts
git commit -m "feat(db): establish clean migration baseline"
```

### Task 3: Create platform identity and organization tables

**Files:**
- Create: `packages/db/migrations/002_platform_identity.sql`
- Test: `packages/db/tests/integration/platform-schema.test.ts`

- [ ] **Step 1: Write schema tests first**

Assert required columns, unique constraints, invitation token hash uniqueness, membership uniqueness, role/status checks, and organization lifecycle checks through actual invalid inserts.

- [ ] **Step 2: Implement the schema**

Create `organizations`, `users`, `auth_login_attempts`, `user_sessions`, `platform_operators`, `organization_memberships`, `organization_invitations`, `organization_data_placements`, and `audit_events`. Use UUID primary keys, timestamptz, explicit check constraints, and case-insensitive normalized email columns. Login attempts store hashed state/nonce plus an encrypted PKCE verifier with short expiry. User sessions and invitations store token hashes, never raw tokens.

Required membership roles: `owner`, `admin`, `staff`, `viewer`. Required organization states: `active`, `suspended`, `deletion_pending`, `purged`.

- [ ] **Step 3: Grant least privilege**

`app_provisioning` receives only the statements required for organizations, users, operators, invitations, initial memberships, placements, and audit. It receives no blanket schema privileges.

- [ ] **Step 4: Verify**

Run: `npm test -w @leadpilot/db -- --run tests/integration/platform-schema.test.ts`  
Expected: PASS, including negative constraint cases.

- [ ] **Step 5: Commit**

```bash
git add packages/db/migrations/002_platform_identity.sql packages/db/tests/integration/platform-schema.test.ts
git commit -m "feat(db): add organization identity schema"
```

### Task 4: Implement transaction-scoped tenant context

**Files:**
- Replace: `packages/db/src/client.ts`
- Create: `packages/db/src/pools.ts`
- Create: `packages/db/src/tenant-context.ts`
- Create: `packages/db/src/provisioning-context.ts`
- Modify: `packages/db/src/index.ts`
- Test: `packages/db/src/tenant-context.test.ts`
- Test: `packages/db/tests/integration/tenant-context.test.ts`

- [ ] **Step 1: Write failing unit and integration tests**

Test commit, rollback, connection release, nested-context rejection, missing organization rejection, and transaction-local setting reset after release.

- [ ] **Step 2: Implement the scoped callback**

Before coding, run `npm view pg version` and `npm view @types/pg version`, install the returned exact versions in `@leadpilot/db`, and commit `package-lock.json` with this task.

```ts
export async function withOrganizationContext<T>(
  context: OrganizationDataContext,
  run: (tx: TenantTransaction) => Promise<T>,
): Promise<T> {
  const client = await runtimePool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.organization_id', $1, true)", [context.organizationId]);
    await client.query("SELECT set_config('app.actor_type', $1, true)", [context.actor.type]);
    const value = await run(createTenantTransaction(client, context));
    await client.query('COMMIT');
    return value;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

Do not export `runtimePool`, `PoolClient`, or a generic query function from the package root. Test helpers live behind `@leadpilot/db/testing` only.

- [ ] **Step 3: Verify**

Run: `npm test -w @leadpilot/db -- --run src/tenant-context.test.ts tests/integration/tenant-context.test.ts`  
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src packages/db/tests/integration/tenant-context.test.ts packages/db/package.json package-lock.json
git commit -m "feat(db): add transaction scoped tenant context"
```

### Task 5: Add reusable RLS helpers and organization policy

**Files:**
- Create: `packages/db/migrations/003_tenant_security.sql`
- Test: `packages/db/tests/integration/organization-rls.test.ts`

- [ ] **Step 1: Write adversarial tests**

Create two organizations as the provisioning role. As the runtime role, verify absent context cannot read either; organization A context cannot read/update B; worker context follows the same boundary; and an attempted `SET ROLE` or `row_security = off` fails.

- [ ] **Step 2: Add the helper and policies**

```sql
CREATE SCHEMA IF NOT EXISTS app;

CREATE FUNCTION app.current_organization_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.organization_id', true), '')::uuid
$$;
```

Enable and force RLS on tenant-visible organization configuration rows when those tables are added. Revoke public execution on helper/security-definer functions and grant only required runtime roles.

- [ ] **Step 3: Verify**

Run: `npm run test:isolation -w @leadpilot/db -- --run tests/integration/organization-rls.test.ts`  
Expected: PASS with explicit A→B and B→A denial cases.

- [ ] **Step 4: Commit**

```bash
git add packages/db/migrations/003_tenant_security.sql packages/db/tests/integration/organization-rls.test.ts
git commit -m "feat(db): enforce tenant context with RLS"
```

### Task 6: Add repository architecture enforcement

**Files:**
- Create: `packages/db/src/architecture.test.ts`
- Create: `packages/db/src/platform/organization.repository.ts`
- Create: `packages/db/src/platform/invitation.repository.ts`
- Create: `packages/db/src/platform/audit.repository.ts`
- Test: `packages/db/src/platform/organization.repository.test.ts`
- Test: `packages/db/src/platform/invitation.repository.test.ts`
- Test: `packages/db/src/platform/audit.repository.test.ts`

- [ ] **Step 1: Write architecture assertions**

Fail when a tenant repository imports pools directly, accepts a bare `organizationId` argument, interpolates SQL identifiers, or exports its underlying client. Platform repositories must require `ProvisioningTransaction`; tenant repositories must require `TenantTransaction`.

- [ ] **Step 2: Implement the minimal platform repositories**

Use parameterized SQL and explicit column lists. Return domain-shaped records, not `SELECT *` database rows. Invitation lookup accepts a token hash, and audit insertion rejects metadata keys named `password`, `token`, `authorization`, or `content`.

- [ ] **Step 3: Verify and commit**

Run: `npm test -w @leadpilot/db && npm run typecheck -w @leadpilot/db`  
Expected: PASS.

```bash
git add packages/db/src
git commit -m "feat(db): add constrained platform repositories"
```

### Task 7: Database foundation completion audit

**Files:**
- Create: `docs/superpowers/plans/multi-tenant-plans/evidence/02-rls-inventory.txt`
- Create: `docs/superpowers/plans/multi-tenant-plans/evidence/02-composite-fk-inventory.txt`
- Create: `docs/superpowers/plans/multi-tenant-plans/evidence/02-database-foundation-completion.md`

- [ ] Bootstrap a fresh test database twice.
- [ ] Run all DB unit and integration tests.
- [ ] Run A→B, B→A, absent-context, rollback, and bypass attempts.
- [ ] Query `pg_class.relrowsecurity` and `relforcerowsecurity` for every tenant table and save results to `docs/superpowers/plans/multi-tenant-plans/evidence/02-rls-inventory.txt`.
- [ ] Query foreign keys and save composite ownership coverage to `docs/superpowers/plans/multi-tenant-plans/evidence/02-composite-fk-inventory.txt`.
- [ ] Search package exports and prove no raw runtime pool/query client is public.
- [ ] Produce `02-database-foundation-completion.md` with exact bootstrap commands, exit codes, test counts, tenant attack results, package-export review, and zero skipped tests.
