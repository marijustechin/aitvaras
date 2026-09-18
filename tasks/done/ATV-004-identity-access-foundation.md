# ATV-004 — Identity & access foundation

**Status:** done
**Date:** 2026-09-18
**Target repository:** `/aitvaras`
**Workspace ID:** O-037 (user-designated "O-036"; see note below)

> Note: this task was issued as "O-036", but that workspace ID is already used
> by "Obtain business answers on Aitvaras ownership/write authority". To keep
> workspace IDs unique (harness rule), this implementation is tracked as
> **O-037**. The app-level ID is `ATV-004`.

## Objective

Implement the first confirmed Aitvaras functional scope: users, credential-based
login, authentication, authorization and the four confirmed roles. No other
(functional) scope.

## Confirmed requirements

- Aitvaras needs users, credential-based login, authentication, authorization
  and roles.
- Initial roles: `Admin`, `WarehouseWorker`, `Accounting`, `ProductionManager`.
- Everything else is unknown and must not be inferred from `/sandelys`.

## Implementation

- **Prisma models:** `User` (UUID id, unique `username`, `passwordHash`,
  `active`, timestamps), `Role` (UUID id, unique semantic `key`, `name`),
  explicit `UserRole` join. Only these tables were created.
- **Contracts (`@aitvaras/contracts`):** `ROLE_KEYS`/`ROLE_LABELS`/`ROLE_CATALOG`,
  `LoginRequest`/`LoginResponse`/`AuthenticatedUser`,
  `UserSummary`/`CreateUserRequest`/`UpdateUserRequest` (Zod).
- **API:**
  - `auth/` — `POST /auth/login`, `GET /auth/me`; Argon2id hashing.
  - `users/` — admin-only `GET /users`, `POST /users`, `PATCH /users/:id`.
  - `access/` — global `JwtAuthGuard` + `RolesGuard`, `@Public`, `@Roles`,
    `@CurrentUser`, role-catalogue seeding, `AuthenticatedUser` type.
  - `prisma/` — `PrismaService`/`PrismaModule`.
  - `common/` — `ZodValidationPipe`.
- **Bootstrap:** `pnpm bootstrap:admin` (env-driven, idempotent, no default
  password, not run at startup).
- **Web:** login page, authenticated shell with current user + logout, admin
  users page; `RequireAuth` role gating; token in `localStorage`; CORS on API.
- **Docs:** `scope.md` (discovery marked as unapproved), `authentication.md`,
  `authorization.md`; README/TODO/architecture/development/testing updated.

## Schema changes

Migration `20260918102917_identity_access` (PostgreSQL): `users`, `roles`,
`user_roles` with FKs, unique index on `users.username`, unique on `roles.key`,
composite PK on `user_roles`. No business-domain tables.

## Security decisions

- **Argon2id** with m=19456 KiB, t=2, p=1; verify via library only; hashes never
  returned or logged.
- **JWT** HS256, required `JWT_SECRET` (≥ 32 chars), short access TTL
  (`JWT_ACCESS_TTL`, default 3600s). Claims: `sub`, `username`, `roles`.
  **No refresh tokens** (not needed for a coherent minimal lifecycle).
- **Generic login failure** for unknown user / wrong password / inactive user.
- **Server-side enforcement** via global guards; UI checks are convenience only.
- **Request validation** via `ZodValidationPipe`; credential fields not logged.
- No secrets committed; `.env.example` holds placeholders only.

## Tests

- Unit: password (3), `AuthService` (6), `JwtAuthGuard` (5), `RolesGuard` (4),
  health (1).
- Integration (real Nest app + Fastify `inject` + Postgres, skipped when DB
  absent): auth (7), users administration (8).
- Total: **34 tests** across 7 files.

## Verification

- `pnpm verify` → **exit 0** (lint, `prisma validate`, typecheck, tests, builds).
- `prisma migrate dev` applied `identity_access`; `prisma migrate deploy` clean.
- `docker compose up -d` → PostgreSQL healthy.
- `pnpm bootstrap:admin` → created ADMIN; second run idempotent.
- Live smoke: `GET /health` 200; `POST /auth/login` 200 (+ `expiresIn` 3600);
  `GET /auth/me` 200; `GET /users` 200; unauthenticated `/auth/me` 401; wrong
  password 401 `"Invalid credentials"`; no hash in responses.
- Web `next build` produced `/`, `/login`, `/admin/users`.

## Limitations

- Web token in `localStorage` (http-only cookie is a planned hardening step).
- No rate limiting / lockout on login yet (next hardening step).
- Role changes apply at next login/expiry.
- No permission model finer than roles; no reset/MFA/SSO (unconfirmed).

## Next logical step

Confirm and implement auth hardening (rate limiting; http-only cookie). Do not
add functional scope; any new scope requires a confirmed requirement (see
`docs/scope.md`).
