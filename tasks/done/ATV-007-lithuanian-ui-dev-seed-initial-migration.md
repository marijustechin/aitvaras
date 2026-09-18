# ATV-007 — Lithuanian UI, development seed and clean initial migration

**Status:** done
**Date:** 2026-09-18
**Target repository:** `/aitvaras`
**Workspace ID:** O-040

## Objective

Foundation refinement only: make the UI Lithuanian (no i18n framework), add a
guarded `localdev` development seed, keep the secure bootstrap separate, and
consolidate the pre-release identity/access migration chain into one clean
initial migration. No new business-domain functionality.

## UI language decision

UI user-facing text is **Lithuanian only**; code identifiers, API paths,
database fields and enum keys remain English. No i18n framework was introduced
(next-intl/react-i18next/catalogues/locale routing) because multi-language is not
a confirmed requirement. Non-Latin string centralisation was kept lightweight.

Translated screens: login (`Prisijungti`, `Naudotojo vardas`, `Slaptažodis`,
errors), authenticated shell (name, `Atsijungti`), admin users
(`Naudotojai`, `Vardas, pavardė`, `Būsena`, `Sukurti naudotoją`, `Redaguoti`,
`Išsaugoti`, `Atšaukti`, `Aktyvus`/`Neaktyvus`), and `403 — Prieiga uždrausta`.

## Visual direction

Preserved: minimalist, strict, high-contrast **monochrome** (white/black/grey);
colour reserved for semantic meaning (errors/status/destructive). No redesign,
gradients or illustrations.

## Role-label implementation

Canonical English keys unchanged (`ADMIN`, `WAREHOUSE_WORKER`, `ACCOUNTING`,
`PRODUCTION_MANAGER`). A single mapping `ROLE_LABELS` in `@aitvaras/contracts`
provides Lithuanian labels; components use it and never render raw keys. Added a
contracts test asserting every key has a non-empty, non-key label.

## Development seed and safety guard

`pnpm seed:dev` → `apps/api/src/scripts/seed-dev.ts` (`seedDevelopmentUser`).
Creates/ensures `localdev` / `localdev` (Local Developer, ADMIN, active),
idempotently (`user.upsert` + `userRole.upsert`). Guarded in code: refuses unless
`NODE_ENV=development` **and** `DATABASE_URL` host is `localhost`/`127.0.0.1`/
`::1`; explicit environment values are never overridden by `.env`. Never runs at
API startup. `localdev` is not a bootstrap fallback.

## Secure bootstrap-admin status

`pnpm bootstrap:admin` unchanged: requires
`BOOTSTRAP_ADMIN_USERNAME`/`_FIRST_NAME`/`_LAST_NAME`/`_PASSWORD`, no defaults,
idempotent, not run at startup. Separate from the dev seed.

## Migration-history review and consolidation

Assumptions verified: Aitvaras is pre-release (no production deployment, no
shared environment), `/aitvaras` changes uncommitted, local DB disposable, and
no external consumer of migration IDs. Therefore consolidation was safe.

Replaced the three iterative migrations with one:
`20260918111802_initial_identity_access`, creating the final schema directly
(`RoleKey` enum; `users` with required `first_name`/`last_name`; `roles`;
`user_roles`; unique indexes; FKs with cascade). The local schema was dropped
and recreated; the migration applied from zero.

## Tests

- Contracts: role-label coverage (every key labelled; label ≠ key).
- Seed: environment guard (refuses non-development / non-local), and an
  integration test for idempotent creation, ADMIN role, names, active, and
  password verification.
- Existing auth/users integration tests unchanged and passing.
- **40 API tests / 9 files pass** (plus contracts tests).

## Verification

- `pnpm verify` → **exit 0** from a **fresh database** (globalSetup applied the
  single migration).
- `pnpm db:validate` / `pnpm db:generate` → exit 0; `prisma migrate status` →
  up to date (1 migration).
- `pnpm seed:dev` → created `localdev`; re-run idempotent; refuses with
  `NODE_ENV=production` and with a non-local `DATABASE_URL`.
- API on **3010**: login `localdev`/`localdev` 200 (`Local Developer`, ADMIN);
  `/auth/me`; `/users`; bad password 401.
- Web on **3011**: `/login` 200 containing `Prisijungti` / `Naudotojo vardas`.

## Limitations

- Lithuanian only; no i18n infrastructure (by design).
- `localdev` is dev-only; must never be used outside local development.
- Applied migrations become immutable after first shared deployment (ADR-010).
- Existing auth hardening items remain open (rate limiting; http-only cookie).

## Next step

Auth hardening (rate limiting; http-only cookie). No new functional scope.
