# ATV-027 — Administrator-driven password reset

- **Status:** done
- **Scope:** identity & access (confirmed scope)
- **Related workspace record:** `ops/done/2026-09-25-aitvaras-admin-password-reset.md`

## Objective

Give administrators a recovery path when an existing user forgets their
password, without introducing email recovery, reset tokens or a new auth
architecture.

## Implemented

- **Endpoint:** `PATCH /users/:id/password` (ADMIN-only), body `{ password }`.
  Uses the shared `PasswordSchema` (≥ 6, ≤ 200). Returns the safe `UserSummary`
  (never the password/hash).
- **Session invalidation:** added `User.tokenVersion` (Prisma migration
  `add_user_token_version`). Login embeds `ver` in the JWT; the global
  `JwtAuthGuard` compares `ver` with the current `tokenVersion` and returns `401`
  on mismatch. The reset action increments `tokenVersion`, immediately
  invalidating the target's existing tokens. Unknown/deleted users are rejected
  by the same guard.
- **Generic update cleaned:** `password` removed from `UpdateUserRequestSchema`
  (`.strict()`), so the generic `PATCH /users/:id` no longer accepts passwords.
- **Contracts:** `PasswordSchema` (shared), `ResetUserPasswordRequestSchema`,
  `USER_PASSWORD_RESET_ERROR_CODES`; `ZodValidationPipe` now returns
  `code: "VALIDATION_ERROR"`.
- **UI:** inline reset section in the user edit panel — button
  `Nustatyti naują slaptažodį` → `Naujas slaptažodis` / `Pakartoti slaptažodį`,
  action `Pakeisti slaptažodį`, cancel; client-side length/match validation;
  inputs cleared and a success message on success.
- **Auditability:** none implemented. Aitvaras has no audit/event mechanism; not
  built here (per task). Password material is never logged.

## Self-reset semantics

Resetting another user does not affect the administrator's session. Resetting
**one's own** password invalidates the administrator's current session (they must
sign in again). Covered by a test.

## Verification

- `pnpm verify` (lint, Prisma validate, typecheck, contracts/API/web tests,
  build) — see the workspace record for the exact results.
- API: `test/password-reset.e2e.test.ts` (old stops / new works / target session
  revoked / others unaffected / non-admin 403 / unauth 401 / unknown 404 with
  code / short 400 with code / generic update rejects password / self-reset).
- Contracts: `users.test.ts`. Web: `features/manage-users/lib/users.test.ts`.

## Deliberately not included

Email recovery, "forgot password", reset tokens, SMTP, refresh tokens, audit
system, session store, or any broad auth redesign.
