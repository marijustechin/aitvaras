# Backend Architecture (Aitvaras API)

> Status: **approved baseline** (task O-056). This document records the
> **accepted** structure of `apps/api/src` and the rules for how it evolves. It
> is governance documentation only — no code was refactored to produce it.

## Modular monolith

The Aitvaras backend is a **modular monolith**: one deployable NestJS
application composed of well-owned feature modules.

- Do **not** split into microservices without a concrete operational
  requirement.
- A new business capability is first implemented as a module inside the existing
  application, with clear ownership.

## Approved top-level structure

```text
apps/api/src/
├── modules/            business/application features (domain ownership)
├── infrastructure/     technical infrastructure and external adapters
├── common/             cross-cutting technical building blocks only
├── scripts/            administrative/operational entry points
├── app.module.ts       composes modules; wires global providers
├── bootstrap.ts        shared app configuration (cookies, CORS)
└── main.ts             runtime entrypoint
```

### `modules/` — business/application features

Owns business/application features and domain concepts. Current modules:

```text
auth
access
users
partners
resources
packing-forms
health
```

New business concepts normally get their **own module**.

### `infrastructure/` — technical infrastructure

Technical infrastructure and adapters to external systems. Current:

```text
infrastructure/prisma/       Prisma client lifecycle (persistence)
```

Prisma belongs here as persistence infrastructure. Do **not** move business
rules into `infrastructure`.

### `common/` — technical cross-cutting only

Cross-cutting **technical** building blocks with no domain meaning. Current:

```text
auth/          auth cookie helpers
decorators/    @Public, @Roles, @CurrentUser
guards/        JwtAuthGuard, RolesGuard, AuthenticatedUser
validation/    ZodValidationPipe
```

Allowed examples: framework decorators, authorization guards, authentication
principal types, validation pipes, technical helpers shared across modules.

**`common` is not a generic reusable-code dumping ground.** Before adding code
here, ask:

```text
Does this code understand Partner, Resource, Receipt, Stock,
Production, Order, Sale or another business concept?
```

If **yes**, it normally belongs to the relevant business **module**. Forbidden
direction:

```text
common/partner-utils.ts
common/receipt-helper.ts
common/stock-calculator.ts
common/production-rules.ts
```

### `scripts/` — operational entry points

Administrative/operational entry points. Current:

```text
bootstrap-admin.ts
seed-dev.ts
seed-reference-data.ts
```

Scripts should orchestrate existing services/domain logic where practical. Do
not duplicate substantial business rules inside scripts.

## Module ownership

A business concept owns its implementation inside `modules/<feature>/`, keeping
close to it:

- controller(s);
- service(s);
- mapper(s);
- module configuration;
- module-specific rules.

Do **not** create global folders such as `controllers/`, `services/`,
`mappers/`, `repositories/` containing mixed domains.

Module-specific mappers stay module-owned
(`partners/partner.mapper.ts`, `resources/resource.mapper.ts`,
`users/user.mapper.ts`). Avoid a global mixed-domain `common/mappers/` unless a
mapper is genuinely domain-agnostic.

## Controllers stay thin

Controllers handle **HTTP concerns only**:

- routing;
- request extraction;
- guards/decorators;
- validation boundary (`ZodValidationPipe`);
- response shaping via the module mapper.

**No business rules in controllers.** Business decisions belong in
services/domain/application logic.

## Services and business rules

- Simple CRUD-style modules may keep a straightforward service.
- As complexity grows, extract explicit domain rules/use cases when useful;
  avoid giant multi-purpose services; do not let a service become a dumping
  ground.
- Do not split code prematurely.

## Keep simple modules simple

Do **not** introduce architecture layers merely for symmetry. A simple module
may remain:

```text
partners/
├── partner.mapper.ts
├── partners.controller.ts
├── partners.module.ts
└── partners.service.ts
```

Do not automatically expand it into `domain/`, `application/`,
`infrastructure/`, `presentation/`, `repositories/`, `ports/`, `adapters/`,
`use-cases/` without actual complexity requiring it.

## Grow complexity locally

When a module becomes genuinely complex, expand **inside that module**:

> Complexity should be introduced locally when the domain requires it, not
> globally in advance.

Illustrative (not implemented, not approved — no `receipts` module exists):

```text
modules/receipts/
├── receipts.controller.ts
├── receipts.module.ts
├── application/
│   ├── create-receipt.ts
│   ├── confirm-receipt.ts
│   └── cancel-receipt.ts
├── domain/
│   ├── receipt-rules.ts
│   └── receipt-state.ts
└── receipt.mapper.ts
```

## Prisma / repository policy

- Prisma is the current persistence mechanism.
- **Direct Prisma usage inside module services is acceptable** where the module
  is simple.
- Do **not** introduce repository abstractions solely to hide Prisma.
- Create repositories/ports only when there is a real need, for example:
  - persistence behaviour becomes complex;
  - multiple data sources exist;
  - domain logic benefits from separation;
  - testing requires a stable abstraction for a substantive reason.

Avoid abstraction for abstraction's sake.

## Auth / access boundary

Keep these responsibilities distinct:

| Area | Owns |
|---|---|
| `modules/auth` | **Authentication** — "Who are you?": login, password verification, JWT/session identity, login-attempt protection |
| `modules/access` | System **access-role catalogue** / access concepts |
| `common/guards`, `common/decorators` | The Nest/framework **mechanism** used to enforce access rules |

Do not blur these responsibilities unnecessarily.

## Cross-module dependencies

- Keep module dependencies explicit and minimal; avoid cycles.
- A module must not reach into another module's internal files arbitrarily.
- When cross-module behaviour is necessary, use exported services/interfaces
  intentionally, keep ownership clear, and avoid importing implementation
  details across boundaries.
- Do **not** build an event bus or messaging layer without an actual need.

## Shared contracts boundary

- `@aitvaras/contracts` remains the API/schema **contract** boundary where
  appropriate. Do not duplicate request/response validation definitions
  independently across web/API when a shared contract already exists.
- Do **not** move backend business logic into the contracts package. Contracts
  define shapes/validation, not application workflows.

## Future workflow modules

Future workflows such as goods receipt, stock movement, production, order
preparation and sales must be designed as **business modules/workflows from
confirmed requirements**. Do not force them into existing `resources` or
`partners` modules merely because they reference those entities. No such module
is implemented or approved.

## File-placement rule

When adding a backend file, choose ownership by meaning:

```text
business-specific         → modules/<owner>
technical cross-cutting   → common
external infrastructure   → infrastructure
operational entry point   → scripts
```

If ownership is unclear, resolve the architectural responsibility before adding
another generic helper.

## Deliberately not done (no premature architecture)

The following are **not** part of the approved baseline and require real,
recorded complexity to justify:

- relocating `authenticated-user.ts` or reorganising auth folders;
- adding repositories/ports/adapters;
- splitting services;
- renaming modules;
- introducing DDD/Clean-Architecture folders globally;
- creating interfaces purely for future-proofing.

## Related documents

- [architecture.md](architecture.md) — overall application architecture
- [frontend-architecture.md](frontend-architecture.md) — web FSD-lite
- [authorization.md](authorization.md) — roles and route protection
- [testing.md](testing.md) — test layers
- `AGENTS.md` — durable rules for agents
