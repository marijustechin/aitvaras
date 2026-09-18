# Project Context — Aitvaras

> **Status: background / discovery context — NOT an approved roadmap.** See
> `scope.md`. The only confirmed functional scope is identity and access.

Durable context for the Aitvaras project, including what was learned about the
legacy `/sandelys` system while bootstrapping. Facts, assumptions and open
questions are kept separate.

> Recorded: 2026-09-18. Sources are the workspace `docs/` layer and direct
> inspection of the repository. This file summarises; the authoritative detail
> lives in `../../docs/` at the workspace root.

## Observed facts

### Repository / workspace

- The workspace root (`alfasis-sandelys/`) is **not** a Git repository. It is a
  context/management layer (`AGENTS.md`, `TODO.md`, `ops/`, `docs/`).
- `/sandelys` and `/aitvaras` are **independent Git repositories** with separate
  remotes:
  - `/sandelys` → `github.com/pavelasc/sandelys`, branch `alfasis-next`.
  - `/aitvaras` → `github.com/marijustechin/aitvaras`, branch `main`.
- Before this bootstrap, `/aitvaras` contained only a `README.md` and one
  commit. No architecture decision had been made.

### Legacy `/sandelys` (summary of workspace discovery)

- PHP/Laravel **5.4** monolith (PHP `>=5.6.4`, runtime `php:7.0-apache`),
  MySQL **5.7**, Blade views with some Vue 2 / Bootstrap 4. EOL stack.
- **No public API surface of substance**: `routes/api.php` is the Laravel
  default (commented-out example route only).
- Domain model centres on `Stock` (a physical lot/parcel) moving through
  warehouse, sorting (`R`) and packing (`P`) places, with `StockLog` as an
  append-only movement history, plus `Order`, `Sale`, `StockError`, `Place`,
  `Supplier`, `Buyer`, `User`, `Role`, etc.
- Stock lifecycle and roles depend heavily on **seeded numeric IDs** (statuses
  1–6, categories 1–3, role IDs 1–6, hardcoded accountant place `[40]`).
- Money stored as integer cents; EUR assumed. Soft deletes and `owen-it/laravel-
  auditing` audit trail exist.
- Auth is Laravel built-in + roles + policies; there is an IP-whitelist
  middleware (`CheckIp`).
- Business logic is concentrated in fat controllers (notably
  `Admin\ReportController`, ~1,900 lines). There are **no meaningful automated
  tests**.
- Barcode generation happens server-side
  (`StockController::makeBarcode`, numeric date + stock id), rendered with
  `milon/barcode`. Barcode uniqueness is not enforced in the DB.
- Ten report screens exist; their real usage is not yet validated with users.
- Legacy is **tightly coupled to its MySQL schema**; there is no abstraction or
  service boundary to integrate against today.
- Destructive risk exists (`DeleteData` force-delete command). Secrets handling
  is a known concern (`.env.example` contains a live-looking Sentry DSN).

### Production / operations (background, not Aitvaras infrastructure)

- Single DigitalOcean droplet (fra1, `46.101.130.92`), Ubuntu 16.04 EOL, nginx
  1.10, PHP 7.0.33-FPM, MySQL 5.7.33, **no TLS / no domain**.
- Seven app instances each with its own database; deployment is manual
  `git pull --ff-only`. The busiest live instance is `gb`; the root `main`
  instance is inactive.
- No automated backups historically; manual logical backups were created
  2026-09-18 and the main `sandelys` restore was verified.

### This bootstrap

- `/aitvaras` is now a pnpm workspace: TypeScript, Node >= 22, Next.js App
  Router web, NestJS/Fastify API, PostgreSQL + Prisma (empty schema), Zod
  contracts, Vitest, and a `pnpm verify` command.
- The API exposes `GET /health` returning `{ "status": "ok",
  "service": "aitvaras-api" }`.
- Local PostgreSQL is provided via `docker-compose.yml` (local development
  only); no other service is containerised.

## Assumptions (not verified)

- Aitvaras will need to read warehouse data from `/sandelys` in some form before
  or during transition. The mechanism is undecided.
- The business will want Aitvaras to eventually replace, not merely augment,
  the legacy system (ADR-001 states the intent, but sequencing is open).
- PostgreSQL + Prisma is an acceptable Aitvaras-owned persistence choice; it is
  a documented baseline decision, not a business requirement.
- Node.js >= 22, pnpm and Next.js/NestJS are acceptable operational choices for
  the team operating this system.

## Unresolved questions

See [integration-boundaries.md](integration-boundaries.md) for the full list.
Highlights:

- Will `/sandelys` expose an API, or will Aitvaras initially read the legacy DB
  directly?
- Which system owns which entities during transition, and which data may
  Aitvaras modify?
- Is synchronisation pull, push or event-driven, and what latency is required?
- What authentication is needed between the systems?
- Which legacy data must be migrated, and which abandoned?
- Which production instance/database is canonical for the business?

## Related documents

- Workspace strategy: `../../docs/decisions/ADR-001-legacy-maintenance-and-aitvaras-replacement-strategy.md`
- Legacy system: `../../docs/discovery/legacy-system.md`
- Infrastructure: `../../docs/discovery/infrastructure.md`
- Workflows: `../../docs/business/known-workflows.md`
- Pain points: `../../docs/requirements/known-pain-points.md`
