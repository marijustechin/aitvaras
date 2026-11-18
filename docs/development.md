# Development

How to set up and work in the Aitvaras workspace. Run all commands from the
`/aitvaras` directory. The project uses **npm workspaces** exclusively; pnpm and
yarn are not required.

## Prerequisites

- **Node.js >= 22.18** (Prisma ORM 7 requires it; the dev environment uses
  Node 24).
- **npm >= 10** (the workspace pins `npm@12.2.2` via `packageManager`).
- **Docker** with the Compose plugin, for local PostgreSQL.
- On Windows, if PowerShell blocks the npm shim, use `npm.cmd` (or adjust the
  execution policy).

## Install

```bash
npm ci
```

Or, when changing dependencies, `npm install`. Root `package.json` declares the
workspaces and the `allowScripts` approvals required by Prisma/esbuild install
scripts.

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

Aitvaras owns its own PostgreSQL database. It currently contains the confirmed
models: identity/access (`User`, `Role`, `UserRole`), business partners
(`BusinessPartner`, `PartnerRole`), resources and administrator-managed categories
(`Resource`, `ResourceCategory`), packaging/tare master data (`PackagingType`),
warehouses and locations (`Warehouse`, `WarehouseLocation`), goods receipts
(`GoodsReceipt`, `GoodsReceiptLine`), physical receiving (`IncomingDelivery`,
`Batch`, `BatchItem`, `Bag`, `BagCorrection`, `PieceReconciliationLine`,
`ReceivingDiscrepancy`, `DiscrepancySettlement`) and the singleton
`CompanySettings`. There is no stock-balance or movement table; the dashboard
stock summary is a read-only projection of confirmed receiving rows. The
authoritative model list is `packages/database/prisma/schema.prisma`.

### Reference/master data

Packaging types (`Tara`) are **administrator-managed master data**, created and
edited through the app (`/resources/packaging-types`) — there is no reference seed
script. `packaging_types` starts with a single inactive `Nežinoma tara` fallback
(created by the migration) for historical packages. `seed:dev` owns only the local
development login.

```bash
npm run infra:up          # start local PostgreSQL (Docker, bound to 127.0.0.1)
npm run db:generate       # generate the Prisma client
npm run db:migrate        # create/apply a migration
npm run db:validate       # validate the Prisma schema
npm run infra:down        # stop local PostgreSQL
```

- The Prisma schema lives at `packages/database/prisma/schema.prisma`; applied
  migrations live under `packages/database/prisma/migrations/`.
- `DATABASE_URL` must point at the database described by `docker-compose.yml`
  for local development.
- If `prisma migrate dev` reports checksum drift, do **not** reset. See
  [migration-history.md](migration-history.md) for the documented, backup-first
  remediation procedure.
- `packages/database/prisma.config.ts` loads the workspace root `.env` (Prisma
  does not search up to the monorepo root by itself). If no `DATABASE_URL` is
  present it falls back to a local placeholder, so `db:validate`/`db:generate`
  work on a fresh clone. `db:migrate` needs a real `DATABASE_URL` **and** a
  running PostgreSQL instance.

## Test database (integration tests)

> **Automated tests must never use the development database.**

Integration tests run against a dedicated database `aitvaras_test` on the same
local PostgreSQL server (configured by `TEST_DATABASE_URL`). They never read from
or mutate the development database (`DATABASE_URL`), so `npm run verify` is always
safe to run.

```bash
npm run db:test:create    # create aitvaras_test (idempotent; for existing volumes)
npm run db:test:migrate   # apply migrations to the test database
npm run db:test:reset     # reset the test database (DESTRUCTIVE; test DB only)
```

- `TEST_DATABASE_URL` is required for integration tests; if it is missing the
  suite **fails clearly** and never falls back to `DATABASE_URL`.
- A safety guard refuses destructive setup unless the target database name is
  exactly `aitvaras_test`.
- On a fresh Docker volume, `docker/postgres/init/` creates `aitvaras_test`
  automatically; for existing volumes run `npm run db:test:create`.
- If the configured test database is unreachable, integration tests skip
  explicitly (misconfiguration still fails the run); unit tests never need a
  database.

## Authentication setup

### Local development login (weak, guarded)

For local development use the dedicated seed:

```bash
npm run seed:dev
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
2. Run `npm run bootstrap:admin` (idempotent).

`BOOTSTRAP_ADMIN_*` are **optional** and **not required** for normal local
development — the local login is `localdev` / `localdev` via `npm run seed:dev`.
They are **not default local credentials**, and the secure bootstrap fails
without all four. `localdev` is never a fallback for missing bootstrap
variables. See [authentication.md](authentication.md) and
[authorization.md](authorization.md).

## Typical local startup

```bash
npm install
npm run infra:up        # or: docker compose up -d
npm run db:migrate
npm run db:test:create  # ensure the isolated test database exists
npm run db:test:migrate
npm run seed:dev
npm run dev:api         # http://localhost:3010
npm run dev:web         # http://localhost:3011  (login: localdev / localdev)
```

## Running the applications

```bash
npm run dev:api           # NestJS API  → http://localhost:3010/health
npm run dev:web           # Next.js web  → http://localhost:3011
```

## Verification

```bash
npm run verify
```

`verify` is the canonical local check and runs, in order:

1. `npm run lint` — ESLint across the workspace.
2. `npm run db:validate` — Prisma schema validation.
3. `npm run typecheck` — builds `contracts` + `database` (so their `dist` types
   exist) and type-checks every package/app.
4. `npm run test` — Vitest across packages/apps that define tests.
5. `npm run build` — builds libraries, then the API (`nest build`) and web
   (`next build`).

Individual commands:

```bash
npm run lint              # eslint .
npm run typecheck         # build libs, then type-check everything
npm run test              # vitest across the workspace
npm run build             # build everything
```

### Notes and caveats

- `packages/contracts` and `packages/database` are compiled to `dist`; consumers
  resolve their types from there. That is why `typecheck` builds them first. If
  you type-check a single consuming package in isolation, build the libraries
  first (`npm run build:libs`).
- **A shared-package change needs a rebuild _and_ a dev-server restart.** A
  running `npm run dev:api` (`nest start --watch`) watches only `apps/api`, and a
  long-running `next dev` can keep serving a stale bundle; neither reliably
  picks up a rebuilt workspace `dist`. After changing `@aitvaras/contracts` /
  `@aitvaras/database` (or a shared policy such as `PasswordSchema`), rebuild the
  libraries and restart the dev servers — otherwise the running process keeps
  enforcing the old contract (a stale API once kept rejecting a 6-character
  password with the previous 8-character minimum).
- `prisma generate` does not require a running database.
- `npm run db:migrate` **does** require local PostgreSQL to be running.
- **Prisma ORM 7** is used (ADR-008). The new `prisma-client` generator emits
  plain TypeScript into `packages/database/src/generated/prisma` (git-ignored),
  which the database package compiles; `migrate dev` no longer generates the
  client automatically, so `prisma generate` is run explicitly in the build
  scripts. The database URL is configured in `packages/database/prisma.config.ts`.
- **npm workspaces** are the only supported workspace setup. The root
  `package.json` declares `workspaces`, `packageManager: npm@12.2.2` and the
  `allowScripts` approvals for the Prisma/esbuild install scripts. `npm ci` uses
  the single root `package-lock.json`; there is no pnpm/yarn lockfile.
- **TypeScript 6** is pinned workspace-wide because `@nestjs/schematics@12`
  requires `typescript >= 6`. The shared base tsconfig keeps
  `moduleResolution: node` with `ignoreDeprecations: "6.0"`; migrating to the
  Node16/bundler resolution mode is separate follow-up work (TS 7 will require
  it).
- **Adding required person-name columns** follows a two-step production-safe
  pattern: a nullable transitional migration, then a `SET NOT NULL` migration.
  Existing rows must be backfilled with real names between the two. The local
  development database is disposable, so its bootstrap/test users are recreated
  (`npm run bootstrap:admin` or `npm run seed:dev`) rather than given invented names.
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
