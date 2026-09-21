# Testing

Pragmatic test expectations for Aitvaras. The goal is fast, meaningful feedback,
not arbitrary coverage numbers.

## Database isolation (mandatory)

> **Automated tests must never use the development database.**

- Integration tests run against a dedicated **`aitvaras_test`** database via
  `TEST_DATABASE_URL`; they never read from or mutate `DATABASE_URL`.
- A missing `TEST_DATABASE_URL` is a **hard error** (no fallback to the
  development database). A safety guard refuses destructive setup unless the
  target database name is exactly `aitvaras_test`.
- Setup: `pnpm db:test:create` then `pnpm db:test:migrate` (created automatically
  on a fresh Docker volume). `pnpm db:test:reset` resets the test database only.
- Tests may freely create, mutate and delete their own records in the test DB.
  They must **never** preserve development records as a workaround for missing
  isolation.

## Runner

- **Vitest** is the default test runner.
- Run everything with `pnpm test` (part of `pnpm verify`).
- Run a single package with e.g. `pnpm --filter @aitvaras/api test`.
- The API suite has a `globalSetup` that applies committed Prisma migrations
  when PostgreSQL is reachable.

## Test layers

### Unit tests

- Pure logic: domain rules, calculations, validation schemas, mappers, guards.
- Fast, no I/O, no framework bootstrapping.
- Location: next to the code as `*.test.ts`.
- Examples: `apps/api/src/auth/password.test.ts`,
  `src/auth/auth.service.test.ts`, `src/access/{jwt-auth,roles}.guard.test.ts`,
  `packages/contracts/src/health.test.ts`.

### Contract tests

- Verify that shared contracts (`@aitvaras/contracts`) and API responses agree.
- Prefer asserting against Zod schemas so drift is caught automatically.

### Integration tests

- Used when behaviour crosses a real boundary: HTTP handlers, database access,
  real guards.
- Location: `apps/api/test/*.e2e.test.ts`.
- They build the real Nest app (`Test.createTestingModule`) with the Fastify
  adapter and call it via `app.inject(...)`.
- They use the dedicated **test** database (`TEST_DATABASE_URL`, `aitvaras_test`)
  and clean up their own data; they never use the development database.
- Auth is **cookie-based** (ADR-011): login sets an httpOnly cookie which the
  tests read from the response and replay via `app.inject({ cookies: { … } })`;
  the login body never contains the raw token. Covered: valid/invalid/unknown/
  inactive login, cookie attributes (HttpOnly/SameSite/Path/Max-Age), `/auth/me`
  via cookie (and without/invalid/expired), logout cookie clearing, role
  protection, duplicate username, no hash exposure, and login lockout/recovery.
- **They skip themselves (with a warning) when PostgreSQL is unreachable**, so
  `pnpm verify` still passes without Docker. Run `pnpm infra:up` first to
  exercise them.

### End-to-end / UI tests

- Not set up. Add only when there is a real UI flow worth protecting; do not
  introduce a browser test framework pre-emptively.

## Expectations

- Add or update tests for behaviour you change.
- Bug fixes should include a regression test where practical.
- Keep tests deterministic; avoid time, network and ordering dependence.
- Prefer testing behaviour over implementation details.
- A failing or skipped test must not be hidden; document the reason.

## Coverage

There is **no coverage threshold** at this stage. Adding one is a deliberate,
later decision. Focus on testing the behaviour that actually carries risk.

## What not to do (yet)

- Do not add test frameworks beyond Vitest without a concrete need.
- Do not mock the entire world to test a controller; test the boundary
  meaningfully.
- Do not invent a broad test pyramid for business behaviour that is not yet
  defined.
