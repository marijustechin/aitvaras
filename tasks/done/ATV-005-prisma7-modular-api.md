# ATV-005 — Prisma 7 upgrade and modular NestJS layout

**Status:** done
**Date:** 2026-09-18
**Target repository:** `/aitvaras`
**Workspace ID:** O-038

## Objective

Foundation correction only: reassess the Prisma 6 pin and move to Prisma ORM 7,
and reorganise the NestJS API into an explicit modular structure — with no new
business functionality and no behaviour regression.

## Prisma 7 investigation (2026-09-18)

- Official docs now default to **Prisma ORM 8**; Prisma 7 is documented at
  `/orm/v7`.
- npm: `@prisma/client@latest` = **7.10.0** (stable); `prisma@latest` =
  **8.0.0-rc.15** (release candidate). The latest mutually-compatible **stable**
  pair is **7.10.0**.
- Prerequisites: Node ≥ 20.19 (package engine `>=22.18.0`), TypeScript ≥ 5.4.
- Breaking changes adopted: `prisma-client` generator (TS output, required
  `output`), driver adapter required (`@prisma/adapter-pg`), datasource URL in
  `prisma.config.ts`, no automatic `.env` loading, `migrate dev` no longer runs
  `generate`.

## Final decision

Adopt **Prisma ORM 7.10.0** (pinned `prisma`, `@prisma/client`,
`@prisma/adapter-pg`; `pg`), **not** Prisma 8 (only an RC published). Recorded
as **ADR-008**, which amends the Prisma pin in ADR-002.

## Migration changes

- `packages/database/prisma/schema.prisma`: generator → `prisma-client`,
  `output = "../src/generated/prisma"`, `moduleFormat = "cjs"`,
  `importFileExtension = ""`; datasource now only declares `provider`.
- `packages/database/prisma.config.ts`: config-based `datasource.url` +
  `migrations.path`; loads the root `.env` when `DATABASE_URL` is unset.
- `packages/database/src/index.ts`: re-exports the generated client and exposes
  `createPrismaAdapter()`.
- `packages/database/tsconfig.json`: `noUncheckedIndexedAccess: false` for the
  generated (git-ignored) client.
- **No domain-schema change and no new migration.** The existing
  `20260918102917_identity_access` migration history is unchanged and valid.

## Final API directory tree

```text
apps/api/src/
├── modules/
│   ├── access/     access.module.ts, initial-roles.service.ts, role-catalog.ts
│   ├── auth/       auth.module.ts, auth.controller.ts, auth.service.ts,
│   │               password.ts, auth.service.test.ts, password.test.ts
│   ├── users/      users.module.ts, users.controller.ts, users.service.ts,
│   │               user.mapper.ts
│   └── health/     health.module.ts, health.controller.ts, health.controller.test.ts
├── infrastructure/
│   └── prisma/     prisma.module.ts, prisma.service.ts
├── common/
│   ├── decorators/ public.decorator.ts, roles.decorator.ts, current-user.decorator.ts
│   ├── guards/     jwt-auth.guard.ts, roles.guard.ts, authenticated-user.ts, *.test.ts
│   └── validation/ zod-validation.pipe.ts
├── scripts/        bootstrap-admin.ts
├── app.module.ts
└── main.ts
```

## Module-boundary decisions

- `modules/*` own feature/domain functionality and data access
  (`auth`, `users`, `access`, `health`).
- `infrastructure/prisma` owns only the Prisma client lifecycle/DB wiring.
- `common/{decorators,guards,validation}` holds **generic** cross-cutting
  security/validation primitives (`JwtAuthGuard`, `RolesGuard`, `@Public`,
  `@Roles`, `@CurrentUser`, `ZodValidationPipe`). The `access` module owns the
  role catalogue — a domain concern.
- `AppModule` composes modules and registers the two global `APP_GUARD`s; no
  business logic.
- Dependency direction: `modules → infrastructure` and `modules → common`.

## Files moved/changed

Moved under `apps/api/src/`: `auth/*`→`modules/auth/*`, `users/*`→`modules/users/*`,
`access/*` split into `modules/access/*` (role catalogue) and
`common/guards|decorators` (guards/decorators), `health/*`→`modules/health/*`,
`prisma/*`→`infrastructure/prisma/*`, `common/zod-validation.pipe.ts`→
`common/validation/`. New `modules/access/access.module.ts`. Updated imports in
`app.module.ts`, `users.service.ts`, controllers, guards, tests, and
`scripts/bootstrap-admin.ts` (now constructs the client with the adapter).
`packages/database/*` updated per the migration section. `apps/api/package.json`
drops the direct `@prisma/client` dependency. Root `engines.node` → `>=22.18.0`.

## Tests

Unchanged in intent, all passing: 34 tests / 7 files — unit (password 3,
AuthService 6, JwtAuthGuard 5, RolesGuard 4, health 1) and integration
(auth 7, users 8) against local PostgreSQL.

## Verification

- `pnpm verify` → **exit 0** (lint, `prisma validate`, typecheck, tests, builds).
- `prisma --version` → prisma 7.10.0 / @prisma/client 7.10.0 (Query Compiler
  enabled).
- `prisma migrate status` → 1 migration, "Database schema is up to date".
- `pnpm bootstrap:admin` → idempotent skip (admin already present).
- Runtime smoke: Nest modules initialised (`PrismaModule`, `AccessModule`,
  `AuthModule`, `UsersModule`, `HealthModule`); `/health` 200; `/auth/login` 200
  (`expiresIn` 3600, roles ADMIN); `/auth/me` 200; `/users` 200;
  unauthenticated `/auth/me` 401.
- `next build` → `/`, `/login`, `/admin/users`.

## Limitations

- Prisma 8 upgrade deferred (only an RC published); revisit when 8.0.0 stable.
- Driver adapter uses `pg` pool defaults (no explicit pool/timeout tuning yet).
- Generated client is git-ignored and compiled per build (no checked-in output).
- Existing auth hardening limitations remain (rate limiting; http-only cookie).

## Next step

Confirm auth hardening (rate limiting; http-only cookie). Adopt Prisma 8 only
when it is a stable release (ADR-008 revisit conditions). No new functional
scope.
