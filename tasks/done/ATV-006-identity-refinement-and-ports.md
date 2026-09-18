# ATV-006 — Identity model refinement and development port standardisation

**Status:** done
**Date:** 2026-09-18
**Target repository:** `/aitvaras`
**Workspace ID:** O-039

## Objective

Foundation refinement only: add real first/last name fields to the user model,
make the role key a typed enum while keeping the relational multi-role model,
and standardise local development ports (API 3010, Web 3011). No new
business-domain functionality; no behaviour regression.

## Schema change

- `User`: added required `firstName` / `lastName` (`first_name`/`last_name`,
  `VARCHAR(100)`); `username` remains the unique login credential.
- `Role.key`: `String` → `RoleKey` **enum** (ADMIN, WAREHOUSE_WORKER,
  ACCOUNTING, PRODUCTION_MANAGER). `Role` and `UserRole` retained; multiple
  roles per user preserved.

## Migration strategy

Two production-safe migrations (the original `identity_access` migration is
untouched):

1. `20260918110518_add_user_name_fields_and_role_key_enum` — adds
   `first_name`/`last_name` as **nullable**; converts `roles.key` to the
   `RoleKey` enum **in place** with a hand-written cast
   (`USING ("key"::text::"RoleKey")`) because Prisma's generated SQL would have
   dropped and re-added the column.
2. `20260918110538_require_user_name_fields` — `SET NOT NULL` after backfill.

The disposable local dev database had only the bootstrap user, so it was cleared
and recreated with real names via `pnpm bootstrap:admin`, rather than seeding
invented names. Production would backfill real names between the two migrations
(documented).

## Role-model decision

Keep the relational model (`User` — `UserRole` — `Role`) with multi-role
support. `RoleKey` is the canonical, typed role identifier, present as a
PostgreSQL enum (Prisma) and as `ROLE_KEYS` in `@aitvaras/contracts`; a test
(`modules/access/role-catalog.test.ts`) asserts the two stay in sync.

## Port configuration

| Service | Default | Configurable |
|---|---|---|
| API | `http://localhost:3010` | `API_PORT` (validated 1–65535) |
| Web | `http://localhost:3011` | `apps/web` dev script `next dev --port 3011` |

The web app uses `NEXT_PUBLIC_API_URL` (default `http://localhost:3010`) and
never assumes same-port. CORS uses `WEB_ORIGIN` (default
`http://localhost:3011,http://127.0.0.1:3011`). `.env.example` updated.

## Implementation

- Contracts: `AuthenticatedUser`, `UserSummary`, `CreateUserRequest`,
  `UpdateUserRequest` now include `firstName`/`lastName`; name parts validated
  non-empty (trimmed, ≤100); update supports name roles/active/password.
- API: `auth` returns names via `/auth/me` and login body (JWT claims unchanged:
  `sub`, `username`, `roles`); `users` create/update handle names; bootstrap
  requires `BOOTSTRAP_ADMIN_FIRST_NAME`/`_LAST_NAME`; `main.ts` defaults/validates
  `API_PORT` and defaults CORS to the 3011 web origin.
- Web: home shell shows the person's real name (username secondary); admin users
  page has First/Last name on create, a Name column, and inline edit of names,
  roles (multi) and active.
- Docs: authentication, authorization, development, architecture, README,
  `.env.example`, AGENTS; ADR-009 accepted, ADR-007 amended.

## Tests

- Updated `auth.service.test.ts`, `auth.e2e.test.ts`, `users.e2e.test.ts` for
  names; added users validation test (missing names → 400) and role/contract
  sync test. **36 tests / 8 files pass** (was 34).

## Verification

- `pnpm verify` → **exit 0** (lint, prisma validate, typecheck, 36 tests,
  `nest build`, `next build`).
- `prisma migrate status` → 3 migrations, up to date.
- Live smoke (API on `3010`): bootstrap (with names, idempotent); login;
  `/auth/me` returns `firstName`/`lastName`; create user with names + one role;
  login works; PATCH changed names + two roles; deactivate → login `401`.
- Web (`next start --port 3011`): `GET /login` 200 and `GET /` 200.

## Limitations

- Names are display identity only; no profile, email, phone, avatar.
- JWT claims remain `sub`/`username`/`roles` (names resolved from `/auth/me`).
- Existing auth-hardening items remain open (rate limiting; http-only cookie).
- Production deployments must backfill real names between the two migrations.

## Next step

Auth hardening (rate limiting; http-only cookie). No new functional scope.
