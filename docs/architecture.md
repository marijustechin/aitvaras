# Aitvaras Architecture

> Status: foundation implemented for the **only confirmed scope — identity and
> access** (`scope.md`). Everything else is discovery. Candidate modules below
> are *not* approved. Unverified choices are marked as open questions.

## Current implemented structure (confirmed scope)

```text
apps/api/src/
├── modules/                    feature / domain modules
│   ├── auth/                   login, /auth/me, Argon2id hashing
│   ├── users/                  admin user lifecycle (/users)
│   ├── access/                 role catalogue + access domain primitives
│   └── health/                 /health (public)
├── infrastructure/             infrastructure adapters
│   └── prisma/                 PrismaService / PrismaModule (Prisma 7 wiring)
├── common/                     cross-cutting technical concerns
│   ├── decorators/             @Public, @Roles, @CurrentUser
│   ├── guards/                 JwtAuthGuard, RolesGuard, AuthenticatedUser
│   └── validation/             ZodValidationPipe
├── scripts/                    bootstrap-admin.ts
├── app.module.ts               composes modules; registers global guards
└── main.ts

packages/contracts/src/  roles.ts, auth.ts, users.ts, health.ts
packages/database/       Prisma 7, generated client + adapter (see ADR-008)
```

- **Feature modules** under `modules/` own their functionality. **Infrastructure**
  adapters under `infrastructure/`. Only genuinely cross-cutting technical
  helpers live in `common/` (no domain logic).
- **Prisma 7** (`prisma-client` generator, TypeScript output at
  `packages/database/src/generated/prisma`, `@prisma/adapter-pg`). See
  [ADR-008](../../docs/decisions/ADR-008-prisma-7-and-api-module-layout.md).
- Prisma contains **only** the identity/access models: `User` (unique `username`
  + `firstName`/`lastName` + `active`), `Role` (canonical `RoleKey` enum), and
  `UserRole` (many-to-many). No other tables exist.
- `AppModule` composes `PrismaModule`, `AccessModule`, `AuthModule`,
  `UsersModule`, `HealthModule` and registers the global guards.
- See `authentication.md`, `authorization.md` and `scope.md`.

## API module conventions (NestJS)

- `modules/<feature>/` — one Nest module per feature/domain capability
  (module, controller(s), service(s), feature-local helpers). A module owns its
  data access and business rules.
- `infrastructure/<adapter>/` — adapters to external systems. `prisma` owns the
  Prisma client lifecycle only.
- `common/` — cross-cutting technical concerns with no domain meaning
  (`decorators/`, `guards/`, `validation/`). Do **not** put domain logic here.
- `AppModule` composes modules and wires global providers (e.g. `APP_GUARD`); it
  holds no business logic.
- Dependency direction: `modules → infrastructure` and `modules → common`;
  `common` depends on nothing domain-specific. Feature modules do not import
  each other's internals; share through explicit provider exports.
- Create directories only when they contain real code.

Global security primitives (`JwtAuthGuard`, `RolesGuard`, `@Public`, `@Roles`,
`@CurrentUser`) live in `common/` because they are generic application security
concerns; the `access` module owns the role catalogue.

## UI language, style and migrations

- The UI is **Lithuanian only**; code/API/database identifiers remain English.
  Role display uses the centralised Lithuanian `ROLE_LABELS`. There is no i18n
  framework (multi-language is not a confirmed requirement) — see ADR-010.
- Visual direction is **minimalist high-contrast monochrome**; colour is reserved
  for semantic meaning.
- Approved brand assets live in `apps/web/public/brand/`; see
  [branding.md](branding.md) for the variant usage convention.
- The database has exactly one migration, `initial_identity_access` (identity/
  access only). Applied migrations become immutable after the first shared/
  production deployment (ADR-010).

## Purpose

Aitvaras is a separate application, not `/sandelys v2`. It has its own web UI,
its own API and its own PostgreSQL database. It must remain architecturally
separable from the legacy warehouse implementation.

## Sandėlys is a reference, not a blueprint

Aitvaras is designed from first principles. `/sandelys` is discovery evidence
for terminology, workflows, data, edge cases and integration/migration needs —
it is **not** the architectural, technical or domain-design blueprint. The full
project-wide rule is in [legacy-as-reference.md](legacy-as-reference.md)
(workspace ADR-004).

Consequences for this architecture:

- `Legacy table != Aitvaras entity`; `column != required field`;
  `id != identity`; `workflow != required workflow`.
- Aitvaras defines its own domain model and owns a PostgreSQL schema designed
  for explicit constraints, clear relationships, appropriate uniqueness, safe
  money representation, meaningful state, traceability, migrations and
  maintainability. The legacy MySQL schema is not mirrored.
- No Aitvaras decision may be justified solely with "Sandėlys does it this way";
  decisions cite requirements, domain correctness, maintainability, security,
  performance, simplicity, testability or operational needs.
- Legacy details stop at the integration boundary.

## Applications and packages

```text
apps/
  api/     NestJS + Fastify HTTP API        (@aitvaras/api)
  web/     Next.js App Router UI            (@aitvaras/web)

packages/
  contracts/   shared Zod contracts         (@aitvaras/contracts)
  database/    Prisma / PostgreSQL          (@aitvaras/database)
  config/      shared tsconfig + ESLint base (@aitvaras/config)
```

## Dependency direction

Keep the dependency graph simple and one-directional:

```text
        web
         │  (HTTP)
         ▼
        api
         │
         ▼
  application / domain logic
         │
   ┌─────┴─────┐
   ▼           ▼
database   integrations/
(Prisma)   (e.g. sandelys)
```

Rules:

- `web` talks to `api` over HTTP. It must not read the database directly.
- `api` owns request handling, validation and orchestration. Business rules
  belong in application/domain code, not in controllers.
- `database` and `integrations` are **infrastructure details** used by the
  domain layer through narrow interfaces. They must not contain business rules.
- Nothing in core domain logic may import a legacy integration adapter's
  internals. Legacy access is an implementation detail behind a boundary.

The bootstrap only materialises `web`, `api`, `contracts` and `database`. Domain
and integration layers will appear as real requirements arrive; do not create
empty layers in advance.

## Aitvaras-owned persistence

- Aitvaras owns its own PostgreSQL database and its own Prisma schema.
- `/sandelys` tables are **not** part of the Aitvaras domain model. They must
  never be used as the model for Aitvaras entities.
- The schema currently contains **only** the confirmed identity/access models
  (`User`, `Role`, `UserRole`); no business-domain tables were created.
- Money, identifiers and domain vocabulary are Aitvaras decisions, not inherited
  from legacy conventions (e.g. legacy seeded numeric IDs or integer cents).

## Shared contracts

`@aitvaras/contracts` holds **shared** schemas and types that cross a boundary
(primarily API ↔ web, and test fixtures). It is deliberately small.

Rules:

- Do not turn `contracts` into a dumping ground for internal application code.
- Only put something there when it is genuinely shared or is an external
  boundary contract.
- Prefer Zod for shared contracts; NestJS DTOs remain appropriate at the API
  edge where framework integration helps.

## Integration adapters

The legacy warehouse boundary is described in
[integration-boundaries.md](integration-boundaries.md). Until an integration
contract exists:

- No legacy code, table, column or query may be copied into Aitvaras.
- If temporary direct database reading of the legacy DB is ever required, it
  must live behind a dedicated adapter with a narrow, typed interface, and must
  not leak legacy names into the domain model.

## Candidate Aitvaras modules (not built)

> **Status: candidate / unconfirmed — NOT approved structure.** Derived from
> legacy discovery and kept as evidence only (`scope.md`). Do not create these
> modules, and do not treat them as a roadmap, until a confirmed requirement
> needs one.

| Module | Responsibility | Input/output boundary | Owns data? | Depends on legacy integration? |
|---|---|---|---|---|
| `identity-and-access` | Aitvaras users, authentication, roles/permissions | API + web adapters | Yes (new identities; never legacy passwords) | Only to map/attribute legacy actors |
| `inventory` | Stock lots, lifecycle/status, parent/child lineage, movements | API/domain service; depends on locations/catalog/partners | Yes (eventually) | Yes, while legacy remains source of truth |
| `locations` | Warehouses, places, place types/groups, storage locations | API/admin | Yes (reference) | Yes, to import/read legacy layout |
| `catalog` | Stock categories/types, containers, units | API/admin | Yes (reference) | Yes, to import/read legacy dictionaries |
| `partners` | Suppliers, buyers, countries | API/admin | Yes (reference) | Yes, to import/read legacy partners |
| `orders` | Buyer orders, order lines (type/weight/price), collection, completion, partial sale | API/domain service | Yes (eventually) | Yes, while legacy owns open orders |
| `dispatch` | Sales / `atkrovimai` (single, mass, from order) | API/domain service | Yes (eventually) | Yes, if dispatching legacy-owned stock |
| `discrepancies` | Sorting/packing error records | API/admin | Unknown (semantics unconfirmed) | Possibly |
| `barcode` (cross-cutting) | Barcode value handling, lookup, lineage, label rendering | Domain service + adapter | No (attribute of inventory) | Yes, for legacy barcodes |
| `reporting` (read models) | Report projections over Aitvaras data | API read endpoints | No (projections) | Maybe, for transitional reports |
| `legacy-integration` | `SandelysIntegrationPort` + `LegacyMySqlSandelysAdapter`, mapping, instance config | Infrastructure; called by domain via port | No (adapter only) | This **is** the boundary |
| `audit` (cross-cutting) | Append-only domain event/history | Internal | Yes (Aitvaras history) | No (legacy history is separate) |

Rules:

- Domain modules must depend on `legacy-integration` only through the port
  interface, never on adapter internals or legacy names.
- `reporting` must not own data.
- `barcode` is not an identity provider (see `identity-strategy.md`).
- Do not create these modules until a slice needs them.

## What is deliberately *not* here

- No message broker, cache, job queue or microservices.
- No premature service/module decomposition.
- No generated API client system or ORM-to-Zod code generation.

These are added only against a concrete, recorded requirement.
