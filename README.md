# Aitvaras

Aitvaras is the **future Alfasis warehouse application**: a clean replacement for
the legacy `/sandelys` system, designed from confirmed business requirements, not
from legacy code.

> **Status: identity & access foundation implemented, plus business partners,
> resources and packing forms.** The confirmed functional scope is users,
> credential login, roles and authorization, **Partneriai** (business partners),
> and **Ištekliai** (resources) with fixed resource categories and **Pakavimo
> formos** (packing-form reference data). No other business functionality
> (goods receipt, purchasing, stock, orders, sales, barcode, integration) is
> approved or implemented. See [docs/scope.md](docs/scope.md).

After login, Aitvaras runs as an application: a **sticky top bar** with
role-aware navigation (`Pradžia`, `Partneriai`, `Ištekliai`, plus `Naudotojai`
for admins), a current-user menu with **Mano profilis** (self-service profile
and password change) and a footer. Navigation contains only confirmed,
implemented functionality.

## What Aitvaras is (and is not)

- It **is** a separate application with its own web UI, API and PostgreSQL
  database.
- It **is not** "Sandėlys v2" and **not** a 1:1 rewrite. Legacy is a reference,
  not a blueprint; see
  [docs/legacy-as-reference.md](docs/legacy-as-reference.md) (ADR-004).
- It **is not** tightly coupled to the legacy database. No legacy integration
  exists.
- Development proceeds **step by step from confirmed requirements only**.

## Stack

| Layer | Choice |
|-------|--------|
| Language | TypeScript 5.9 |
| Runtime | Node.js >= 22 |
| Package manager | pnpm (workspaces) |
| Web | Next.js (App Router), React, Tailwind CSS, shadcn/ui-compatible |
| API | NestJS on the Fastify adapter |
| Database | PostgreSQL + Prisma (**Aitvaras-owned schema**) |
| Auth | JWT delivered in an httpOnly cookie (ADR-011), Argon2id password hashing |
| Validation | Zod (shared contracts) + ZodValidationPipe |
| Tests | Vitest (unit + DB integration) |

## Workspace layout

```text
aitvaras/
├── apps/
│   ├── api/                 NestJS + Fastify API
│   │   └── src/{auth,users,partners,resources,packing-forms,access,prisma,common,health}
│   └── web/                 Next.js App Router (login, shell, partners, resources, admin users)
├── packages/
│   ├── config/              shared tsconfig + ESLint base
│   ├── contracts/           shared Zod contracts (@aitvaras/contracts)
│   └── database/            Prisma / PostgreSQL (@aitvaras/database)
├── docs/                    scope, architecture, auth, testing, discovery
├── tasks/                   current/ and done/ task journal
├── docker-compose.yml       local PostgreSQL only
├── AGENTS.md                operating rules for coding agents
└── TODO.md                  roadmap
```

## Local commands

From this directory (`/aitvaras`):

```bash
pnpm install               # install the workspace
pnpm infra:up              # start local PostgreSQL (Docker)
cp .env.example .env        # configure environment (Windows: copy)
pnpm db:generate           # generate the Prisma client
pnpm db:migrate            # create/apply migrations (development DB)
pnpm db:test:create        # create the isolated test database (integration tests)
pnpm db:test:migrate       # apply migrations to the test database
pnpm seed:dev              # local dev login: localdev / localdev (guarded)
pnpm seed:reference        # packing-form reference data (idempotent)
pnpm dev:api               # API    → http://localhost:3010
pnpm dev:web               # web    → http://localhost:3011
pnpm verify                # lint + prisma validate + typecheck + test + build
```

Local ports (defaults, configurable): **API `3010`** (`API_PORT`), **web
`3011`**. The web app targets the API via `NEXT_PUBLIC_API_URL`
(default `http://localhost:3010`).

The UI is **Lithuanian only** (no i18n framework yet). For a real admin account
(no weak credentials), use `pnpm bootstrap:admin` with
`BOOTSTRAP_ADMIN_*` env variables instead of `seed:dev`; those variables are
optional and **not** default local credentials. In development the login screen
shows a muted `localdev / localdev` hint (hidden in production).

Full setup details: [docs/development.md](docs/development.md).

## Documentation

- [docs/scope.md](docs/scope.md) — what is and is not confirmed scope
- [docs/architecture.md](docs/architecture.md) — applications, packages, rules
- [docs/partners.md](docs/partners.md) — the business-partner module
- [docs/resources.md](docs/resources.md) — resources, categories and packing forms
- [docs/domain-glossary.md](docs/domain-glossary.md) — confirmed domain terminology
- [docs/authentication.md](docs/authentication.md) — auth model and login flow
- [docs/authorization.md](docs/authorization.md) — roles and route protection
- [docs/development.md](docs/development.md) — prerequisites and workflow
- [docs/testing.md](docs/testing.md) — test layers and expectations
- [docs/branding.md](docs/branding.md) — brand assets, variants and usage convention
- [docs/legacy-as-reference.md](docs/legacy-as-reference.md) — reference, not blueprint
- Discovery (not a roadmap): [legacy-domain-map.md](docs/legacy-domain-map.md),
  [legacy-workflows.md](docs/legacy-workflows.md),
  [data-ownership.md](docs/data-ownership.md),
  [integration-boundaries.md](docs/integration-boundaries.md)
- [AGENTS.md](AGENTS.md) — rules for agents working in this repository
- [TODO.md](TODO.md) — roadmap and current focus
