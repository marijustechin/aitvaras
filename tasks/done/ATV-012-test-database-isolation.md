# ATV-012 — Isolate integration tests from the development database

**Status:** done
**Date:** 2026-09-18
**Target repository:** `/aitvaras`
**Workspace ID:** O-046

## Objective

Establish strict database isolation so automated tests can never read from or
mutate the normal development database.

## Why tests previously reached the development DB

- `apps/api/test/support/test-env.ts` loaded the workspace root `.env` and read
  `DATABASE_URL` (the development database) for its reachability check.
- `apps/api/test/global-setup.ts` ran `prisma migrate deploy` against that
  `DATABASE_URL`.
- `createTestApp()` built the real `AppModule`; `PrismaService` (and direct
  `PrismaClient` use in the seed test) resolve `process.env.DATABASE_URL`, which
  was the development URL.

There was no test-specific URL, so tests shared the development database.

## Changes

- **Dedicated test database** `aitvaras_test` on the same local PostgreSQL
  server. `docker/postgres/init/01-create-test-database.sql` + a compose mount
  create it on fresh volumes; `pnpm db:test:create`
  (`packages/database/scripts/create-test-db.mjs`) creates it idempotently for
  existing volumes. No extra container.
- **Explicit `TEST_DATABASE_URL`** (`.env.example`, local `.env`). New
  `apps/api/test/support/test-db.ts`:
  - `resolveTestDatabaseUrl()` **throws** if unset — never falls back to
    `DATABASE_URL`;
  - `assertTestDatabase(url)` refuses anything whose database name is not exactly
    `aitvaras_test` (checks the connection target, not `NODE_ENV`);
  - `applyTestDatabaseEnv()` asserts and points the process at the test DB;
  - `isTestDatabaseReachable()` for explicit skips.
- **Test wiring:** `global-setup.ts` resolves/asserts the test URL and runs
  `migrate deploy` with `DATABASE_URL=TEST_DATABASE_URL`; `createTestApp()` calls
  `applyTestDatabaseEnv()` before the app is created; `test-env.ts` removed.
- **seed-dev suite** is destructive again (safe on the isolated test DB): it
  clears `localdev`, seeds twice, asserts create/idempotency, and additionally
  asserts `current_database() = aitvaras_test`.
- **Scripts:** `db:test:create`, `db:test:migrate`, `db:test:reset`
  (`packages/database/scripts/test-db-command.mjs`), all guarded to the test DB.
- **ESLint base** now defines Node globals for `*.js/*.mjs/*.cjs`.
- **Docs/AGENTS:** `development.md`, `testing.md`, `README.md`, `AGENTS.md`
  document the separation and state prominently that automated tests must never
  use the development database.

## Files changed

`/aitvaras`: `apps/api/test/support/{test-db.ts (new), test-db.test.ts (new),
create-test-app.ts}`, `apps/api/test/{global-setup.ts,seed-dev.e2e.test.ts,
auth.e2e.test.ts,users.e2e.test.ts}`, `apps/api/test/support/test-env.ts` (deleted),
`docker-compose.yml`, `docker/postgres/init/01-create-test-database.sql` (new),
`packages/database/scripts/{create-test-db.mjs,test-db-command.mjs}` (new),
`packages/config/eslint.base.mjs`, `package.json`, `.env.example`, `AGENTS.md`,
`README.md`, `docs/{development,testing}.md`;
`tasks/done/ATV-012-test-database-isolation.md`.
Workspace: `ops/done/2026-09-18-aitvaras-test-database-isolation.md`; updated
`docs/system/project-state.md`, `ops/backlog.md`, `ops/current.md`,
`/aitvaras/TODO.md`.
**No tracked `/sandelys` change.**

## Verification

- `pnpm verify` → **exit 0** (lint, prisma validate, typecheck, tests, builds).
- Test run logs show the migration applied to `aitvaras_test`; all integration
  suites (auth 11, users 9, seed 5) pass on the test DB.
- **Development-DB invariant proven:** captured the dev `localdev` fingerprint
  (id, username, active, created_at, updated_at, roles) and dev user count
  before `pnpm verify`; after `pnpm verify` they are **identical** (dev count 1).
  The test DB had 0 users (cleaned) and the applied migration + role catalogue.
- Guard proven: `TEST_DATABASE_URL=<dev>` makes the destructive test command
  refuse (`Refusing: TEST_DATABASE_URL must target "aitvaras_test"`, exit 1);
  unit tests cover the guard and the no-fallback throw.
- Live smoke: `localdev` / `localdev` still logs in (200), `/auth/me` 200, logout
  200 after the change.

## Limitations

- The limiter/state and DB isolation are per local server; test DB uses the same
  PostgreSQL container (intentional).
- On existing volumes the init SQL does not run; `pnpm db:test:create` is the
  documented path.
- `/sandelys` two untracked pnpm files remain (predate this task, not modified).

## Next step

None confirmed.
