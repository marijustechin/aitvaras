# Development

How to set up and work in the Aitvaras workspace. Run all commands from the
`/aitvaras` directory.

## Prerequisites

- **Node.js >= 22.18** (Prisma ORM 7 requires it; the dev environment uses
  Node 24).
- **pnpm** (the workspace pins `pnpm@11.26.0` via `packageManager`).
- **Docker** with the Compose plugin, for local PostgreSQL.
- On Windows, if PowerShell blocks the pnpm shim, use `pnpm.cmd` (or adjust the
  execution policy).

## Install

```bash
pnpm install
```

`pnpm-workspace.yaml` allows install scripts only for packages that need them
(Prisma engines, esbuild, Tailwind's native module). Everything else is
script-free by default.

## Environment

Copy the example file and adjust if needed:

```bash
cp .env.example .env        # Windows: copy .env.example .env
```

`.env` is git-ignored. **Never commit real credentials.** Required variables are
documented in `.env.example`.

## Local ports

| Service | Default URL | Configured via |
|---|---|---|
| API | `http://localhost:3010` | `API_PORT` (validated integer 1–65535) |
| Web | `http://localhost:3011` | `apps/web` `dev` script (`next dev --port 3011`) |

Both are defaults, not constants. The API falls back to `3010` when `API_PORT`
is unset; the web dev script defaults to `3011` and can be overridden by passing
a different `--port`. The web app talks to the API via `NEXT_PUBLIC_API_URL`
(default `http://localhost:3010`) and never assumes the API is on its own port.
CORS allows `WEB_ORIGIN` (default `http://localhost:3011,http://127.0.0.1:3011`)
with credentials. The allowed methods are set explicitly
(`CORS_METHODS` in `apps/api/src/bootstrap.ts`): Fastify's CORS default is only
`GET,HEAD,POST`, which would otherwise let the browser block credentialed
`PATCH`/`PUT`/`DELETE` requests (e.g. profile, user, partner and resource
updates) before they reach the API.

## Database

Aitvaras owns its own PostgreSQL database. It currently contains **only** the
identity/access models (`User`, `Role`, `UserRole`); no business tables exist.

```bash
pnpm infra:up          # start local PostgreSQL (Docker, bound to 127.0.0.1)
pnpm db:generate       # generate the Prisma client
pnpm db:migrate        # create/apply a migration
pnpm db:validate       # validate the Prisma schema
pnpm infra:down        # stop local PostgreSQL
```

- The Prisma schema lives at `packages/database/prisma/schema.prisma`; applied
  migrations live under `packages/database/prisma/migrations/`.
- `DATABASE_URL` must point at the database described by `docker-compose.yml`
  for local development.
- `packages/database/prisma.config.ts` loads the workspace root `.env` (Prisma
  does not search up to the monorepo root by itself). If no `DATABASE_URL` is
  present it falls back to a local placeholder, so `db:validate`/`db:generate`
  work on a fresh clone. `db:migrate` needs a real `DATABASE_URL` **and** a
  running PostgreSQL instance.

## Test database (integration tests)

> **Automated tests must never use the development database.**

Integration tests run against a dedicated database `aitvaras_test` on the same
local PostgreSQL server (configured by `TEST_DATABASE_URL`). They never read from
or mutate the development database (`DATABASE_URL`), so `pnpm verify` is always
safe to run.

```bash
pnpm db:test:create    # create aitvaras_test (idempotent; for existing volumes)
pnpm db:test:migrate   # apply migrations to the test database
pnpm db:test:reset     # reset the test database (DESTRUCTIVE; test DB only)
```

- `TEST_DATABASE_URL` is required for integration tests; if it is missing the
  suite **fails clearly** and never falls back to `DATABASE_URL`.
- A safety guard refuses destructive setup unless the target database name is
  exactly `aitvaras_test`.
- On a fresh Docker volume, `docker/postgres/init/` creates `aitvaras_test`
  automatically; for existing volumes run `pnpm db:test:create`.
- If the configured test database is unreachable, integration tests skip
  explicitly (misconfiguration still fails the run); unit tests never need a
  database.

## Authentication setup

### Local development login (weak, guarded)

For local development use the dedicated seed:

```bash
pnpm seed:dev
```

This creates/ensures the account `localdev` / `localdev` (ADMIN, active,
"Local Developer"), idempotently. It **refuses to run** unless
`NODE_ENV=development` and `DATABASE_URL` points at a local host. It is never
run at API startup. These weak credentials are for local use only and must
never be reused in staging or production.

Browser sessions use an **httpOnly cookie** (ADR-011); no auth token is stored
in `localStorage`/`sessionStorage`. Login brute-force protection is configured
via `LOGIN_MAX_ATTEMPTS` / `LOGIN_WINDOW_SECONDS` / `LOGIN_LOCKOUT_SECONDS`
(see `.env.example`).

### Secure bootstrap admin

There is no default production account and no account is created automatically
at startup. Create the first admin explicitly:

1. In `.env`, set a strong `JWT_SECRET` (≥ 32 chars), plus
   `BOOTSTRAP_ADMIN_USERNAME`, `BOOTSTRAP_ADMIN_FIRST_NAME`,
   `BOOTSTRAP_ADMIN_LAST_NAME` and `BOOTSTRAP_ADMIN_PASSWORD` (≥ 12 chars).
2. Run `pnpm bootstrap:admin` (idempotent).

`BOOTSTRAP_ADMIN_*` are **optional** and **not required** for normal local
development — the local login is `localdev` / `localdev` via `pnpm seed:dev`.
They are **not default local credentials**, and the secure bootstrap fails
without all four. `localdev` is never a fallback for missing bootstrap
variables. See [authentication.md](authentication.md) and
[authorization.md](authorization.md).

## Typical local startup

```bash
pnpm install
pnpm infra:up        # or: docker compose up -d
pnpm db:migrate
pnpm db:test:create  # ensure the isolated test database exists
pnpm db:test:migrate
pnpm seed:dev
pnpm dev:api         # http://localhost:3010
pnpm dev:web         # http://localhost:3011  (login: localdev / localdev)
```

## Running the applications

```bash
pnpm dev:api           # NestJS API  → http://localhost:3010/health
pnpm dev:web           # Next.js web  → http://localhost:3011
```

## Verification

```bash
pnpm verify
```

`verify` is the canonical local check and runs, in order:

1. `pnpm lint` — ESLint across the workspace.
2. `pnpm db:validate` — Prisma schema validation.
3. `pnpm typecheck` — builds `contracts` + `database` (so their `dist` types
   exist) and type-checks every package/app.
4. `pnpm test` — Vitest across packages/apps that define tests.
5. `pnpm build` — builds libraries, then the API (`nest build`) and web
   (`next build`).

Individual commands:

```bash
pnpm lint              # eslint .
pnpm typecheck         # build libs, then type-check everything
pnpm test              # vitest across the workspace
pnpm build             # build everything
pnpm --filter @aitvaras/api build
pnpm --filter @aitvaras/web build
```

### Notes and caveats

- `packages/contracts` and `packages/database` are compiled to `dist`; consumers
  resolve their types from there. That is why `typecheck` builds them first. If
  you type-check a single consuming package in isolation, build the libraries
  first (`pnpm build:libs`).
- `prisma generate` does not require a running database.
- `pnpm db:migrate` **does** require local PostgreSQL to be running.
- **Prisma ORM 7** is used (ADR-008). The new `prisma-client` generator emits
  plain TypeScript into `packages/database/src/generated/prisma` (git-ignored),
  which the database package compiles; `migrate dev` no longer generates the
  client automatically, so `prisma generate` is run explicitly in the build
  scripts. The database URL is configured in `packages/database/prisma.config.ts`.
- **Adding required person-name columns** follows a two-step production-safe
  pattern: a nullable transitional migration, then a `SET NOT NULL` migration.
  Existing rows must be backfilled with real names between the two. The local
  development database is disposable, so its bootstrap/test users are recreated
  (`pnpm bootstrap:admin` or `pnpm seed:dev`) rather than given invented names.
- **Migration history was consolidated once, pre-release.** The iterative
  identity/access migrations were replaced by a single
  `initial_identity_access` migration before any shared/production deployment
  (ADR-010). This is safe only while unreleased. After migrations have been used
  in a shared or production environment, **never rewrite applied migration
  history** — add a new migration instead.
- **Integration tests use a dedicated test database** (`aitvaras_test` via
  `TEST_DATABASE_URL`) and never touch the development database. See
  [testing.md](testing.md). A missing/invalid `TEST_DATABASE_URL` is a hard
  error; an unreachable test database causes explicit skips.
- `docker compose` is only used for local PostgreSQL; applications are not
  containerised.

## Editor / tooling conventions

- TypeScript strict mode, `noUncheckedIndexedAccess`.
- No comments that merely restate code; document *why* when it is non-obvious.
- Shared config lives in `packages/config`; per-app config overrides it.
- The web app is shadcn/ui-ready (`components.json`, `src/lib/utils.ts`, CSS
  design tokens). No component catalog is installed yet; add components only as
  needed.
