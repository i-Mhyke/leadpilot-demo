# Control Plane Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a testable NestJS control-plane application and enforce framework/package boundaries before business features move.

**Architecture:** `apps/api` owns HTTP control-plane concerns. Framework-independent contracts and use cases live in new packages. TanStack server functions become BFF adapters and cannot access PostgreSQL directly.

**Tech Stack:** NestJS, TypeScript, Valibot, Vitest, Supertest, npm workspaces.

---

## File map

- Create `apps/api/*` for the NestJS process and its tests.
- Create `packages/contracts/*` for transport schemas.
- Create `packages/application/*` for framework-neutral use-case ports.
- Modify root workspace scripts only for build, test, and development orchestration.
- Add architecture tests under `apps/web/src/architecture/`.

### Task 1: Scaffold the NestJS application

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/nest-cli.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/vitest.config.ts`
- Create: `apps/api/src/main.ts`
- Create: `apps/api/src/app.module.ts`
- Create: `apps/api/src/health/health.controller.ts`
- Test: `apps/api/test/health.e2e.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing health test**

```ts
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.ts';
import { createApiApp } from '../src/main.ts';

it('GET /health returns the service identity', async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = await createApiApp(moduleRef.createNestApplication());
  await request(app.getHttpServer())
    .get('/health')
    .expect(200)
    .expect({ ok: true, service: 'leadpilot-api' });
  await app.close();
});
```

- [ ] **Step 2: Run the test and verify the missing application failure**

Run: `npm test -w @leadpilot/api -- --run test/health.e2e.test.ts`  
Expected: FAIL because `AppModule` and `createApiApp` do not exist.

- [ ] **Step 3: Add the minimal application**

Implement `createApiApp()` so it applies a global `/api` prefix, `ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })`, and returns the initialized app. `main.ts` must call it and listen only when executed as the entry point. `HealthController` returns the exact tested object.

- [ ] **Step 4: Add workspace scripts**

Add `dev`, `build`, `typecheck`, and `test` scripts to `apps/api/package.json`; add `dev:api` and `build:api` to the root. Pin NestJS dependencies to exact versions obtained with `npm view` before installation and commit the resulting lockfile.

- [ ] **Step 5: Verify the package**

Run: `npm test -w @leadpilot/api && npm run typecheck -w @leadpilot/api && npm run build -w @leadpilot/api`  
Expected: PASS, PASS, PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json apps/api
git commit -m "feat(api): scaffold control plane"
```

### Task 2: Add shared transport contracts

**Files:**
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/src/index.ts`
- Create: `packages/contracts/src/http/problem-details.ts`
- Create: `packages/contracts/src/health.ts`
- Test: `packages/contracts/src/http/problem-details.test.ts`

- [ ] **Step 1: Write failing schema tests**

Test that `ProblemDetailsSchema` accepts `{ type, title, status, detail, correlationId }`, rejects unknown keys, and rejects status values outside `400..599`.

- [ ] **Step 2: Verify failure**

Run: `npm test -w @leadpilot/contracts`  
Expected: FAIL because the schema is missing.

- [ ] **Step 3: Implement exact schemas**

```ts
export const ProblemDetailsSchema = v.strictObject({
  type: v.string(),
  title: v.string(),
  status: v.pipe(v.number(), v.integer(), v.minValue(400), v.maxValue(599)),
  detail: v.string(),
  correlationId: v.string(),
});
export type ProblemDetails = v.InferOutput<typeof ProblemDetailsSchema>;
```

Export all public contracts only through `src/index.ts`. Do not export framework decorators or database rows.

- [ ] **Step 4: Verify and commit**

Run: `npm test -w @leadpilot/contracts && npm run typecheck -w @leadpilot/contracts`  
Expected: PASS.

```bash
git add packages/contracts package.json package-lock.json
git commit -m "feat(contracts): add transport contracts"
```

### Task 3: Add the application package boundary

**Files:**
- Create: `packages/application/package.json`
- Create: `packages/application/tsconfig.json`
- Create: `packages/application/src/index.ts`
- Create: `packages/application/src/common/clock.ts`
- Create: `packages/application/src/common/id-generator.ts`
- Create: `packages/application/src/common/result.ts`
- Test: `packages/application/src/common/result.test.ts`

- [ ] **Step 1: Test the result contract**

Write tests for `ok(value)`, `err(code, message)`, and exhaustive narrowing on `result.ok`.

- [ ] **Step 2: Verify failure, implement, and verify pass**

```ts
export type AppResult<T, C extends string> =
  | { ok: true; value: T }
  | { ok: false; error: { code: C; message: string } };
```

Run: `npm test -w @leadpilot/application && npm run typecheck -w @leadpilot/application`  
Expected: PASS.

- [ ] **Step 3: Add dependency-direction tests**

Create a test that recursively scans `packages/application/src` and fails on imports containing `@nestjs/`, `@tanstack/`, `@flue/`, or `@leadpilot/db`. This makes the application layer framework- and persistence-independent.

- [ ] **Step 4: Commit**

```bash
git add packages/application package.json package-lock.json
git commit -m "feat(application): establish use case boundary"
```

### Task 4: Standardize API errors and correlation IDs

**Files:**
- Create: `apps/api/src/common/http/correlation-id.middleware.ts`
- Create: `apps/api/src/common/http/problem-details.filter.ts`
- Create: `apps/api/src/common/http/http.module.ts`
- Test: `apps/api/test/problem-details.e2e.test.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Write failing tests**

Test that an unknown route returns a stable problem-details body and `x-correlation-id`; test that a supplied valid correlation ID is preserved; test that stack traces are absent.

- [ ] **Step 2: Implement middleware and filter**

Generate UUID correlation IDs, attach them to request/response, and map known application error codes to stable HTTP statuses. Unknown errors return status `500`, type `internal_error`, and a generic detail. Never return `error.stack`, SQL text, token contents, or raw provider bodies.

- [ ] **Step 3: Verify**

Run: `npm test -w @leadpilot/api -- --run test/problem-details.e2e.test.ts`  
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/common apps/api/test/problem-details.e2e.test.ts apps/api/src/app.module.ts
git commit -m "feat(api): standardize safe errors"
```

### Task 5: Establish the TanStack API client and record migration debt

**Files:**
- Create: `apps/web/src/lib/api-client.ts`
- Test: `apps/web/src/lib/api-client.test.ts`
- Create: `docs/superpowers/plans/multi-tenant-plans/evidence/01-current-web-db-imports.txt`

- [ ] **Step 1: Record the current violations**

Run `rg -n '@leadpilot/db|@neondatabase|\bpg\b' apps/web/src` and save the complete output in the evidence file. This is the fixed migration inventory consumed by later plans.

- [ ] **Step 2: Write failing API-client tests**

Cover success, structured problem response, invalid JSON, timeout, and missing configuration.

- [ ] **Step 3: Add the typed API client**

Implement `apiRequest<T>()` with base URL configuration, correlation ID forwarding, JSON parsing, timeout, and `ProblemDetails` error conversion. Its tests must cover success, structured error, invalid JSON, timeout, and missing configuration.

- [ ] **Step 4: Verify**

Run: `npm test -w @leadpilot/web -- --run src/lib/api-client.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/api-client.ts apps/web/src/lib/api-client.test.ts docs/superpowers/plans/multi-tenant-plans/evidence/01-current-web-db-imports.txt
git commit -m "test(web): enforce API boundary"
```

### Task 6: Foundation review gate

**Files:**
- Create: `docs/superpowers/plans/multi-tenant-plans/evidence/01-foundation-completion.md`

- [ ] Run API, contracts, and application tests.
- [ ] Run their typechecks and builds.
- [ ] Confirm all tests run by this plan pass.
- [ ] Run `rg -n '@nestjs|@tanstack|@flue' packages/application/src` and require no output.
- [ ] Inspect Postiz references for concepts only; verify no copied namespace, import, comment, or source block exists.
- [ ] Produce `01-foundation-completion.md` with the exact commands, exit codes, test counts, architecture-scan result, copied-code review, and direct-DB inventory verdict.
