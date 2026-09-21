# ATV-010 — Auth hardening and login UX completion

**Status:** done
**Date:** 2026-09-18
**Target repository:** `/aitvaras`
**Workspace ID:** O-044

## Objective

Complete the identity/access foundation: move browser auth to an httpOnly cookie
(no `localStorage`), add logout, review CSRF/CORS, add login rate limiting/
lockout, add an accessible password visibility toggle, and update tests/docs.
No business-domain functionality.

## Implementation

- **httpOnly cookie auth (ADR-011):** `POST /auth/login` issues the JWT only as
  the `aitvaras_access` cookie (`HttpOnly`, `SameSite=Lax`, `Secure` in
  production, `Path=/`, `Max-Age=JWT_ACCESS_TTL`); the JSON body returns safe
  user data only. `@fastify/cookie` registered via a shared `configureApp()`
  helper used by `main.ts` and tests.
- **Guard sources:** `JwtAuthGuard` reads the cookie first, then an
  `Authorization: Bearer` header (retained for API/tooling only).
- **Logout:** `POST /auth/logout` clears the cookie with matching attributes.
- **CORS:** credentialed (`credentials: true`) with explicit origins from
  `WEB_ORIGIN`; wildcard rejected at startup (`bootstrap.ts`).
- **CSRF:** `SameSite=Lax` + same-site deployment is sufficient; no CSRF token
  (documented; a token becomes required if the API is ever cross-site).
- **Rate limiting / lockout:** `LoginAttemptService` (process-local) counts
  failures per username and per client IP in a sliding window and temporarily
  locks at the threshold (defaults 5 / 900 s / 900 s, env-configurable).
  Locked attempts return the same generic `401`; counters reset on success and
  expire naturally. Accounts are never permanently locked.
- **Password toggle:** accessible eye/eye-off control in the Lithuanian login
  form (`type="button"`, `aria-label` "Rodyti/Slėpti slaptažodį"); inline SVG, no
  new icon dependency.
- **Session expiry UX:** 401 clears client session state and redirects to
  `/login` (admin page handles 401 explicitly); no refresh tokens.
- **Contracts:** `LoginResponse` now `{ user }`; added `LogoutResponse`.

## Files changed

`/aitvaras`: `apps/api/src/bootstrap.ts` (new),
`apps/api/src/common/auth/auth-cookie.ts` (new),
`apps/api/src/common/guards/jwt-auth.guard.ts` (+test),
`apps/api/src/modules/auth/{auth.controller,auth.service,auth.module}.ts`,
`apps/api/src/modules/auth/login-attempt.service.ts` (+test),
`apps/api/src/main.ts`, `apps/api/package.json`,
`apps/api/test/{auth.e2e,users.e2e}.test.ts`,
`apps/api/test/support/create-test-app.ts` (new),
`packages/contracts/src/auth.ts`,
`apps/web/src/lib/api.ts`, `apps/web/src/components/auth-provider.tsx`,
`apps/web/src/app/{login/page,page,admin/users/page}.tsx`,
`.env.example`, `AGENTS.md`, `README.md`,
`docs/{authentication,authorization,development,testing}.md`.
Workspace: new `docs/decisions/ADR-011-browser-auth-httponly-cookie.md`,
`ops/done/2026-09-18-aitvaras-auth-hardening.md`; updated
`docs/decisions/README.md`, `docs/system/project-state.md`, `ops/backlog.md`,
`ops/current.md`, `/aitvaras/TODO.md`.
**No tracked `/sandelys` change.**

## Verification

- `pnpm verify` → **exit 0** (lint, prisma validate, typecheck, **56 tests**,
  `nest build`, `next build`).
- Live smoke (PostgreSQL; API 3010): login 200 with no `accessToken` in the body;
  `Set-Cookie` has `HttpOnly; SameSite=Lax; Path=/; Max-Age=3600`; `/auth/me` and
  `/users` succeed via cookie; logout clears the cookie (`Max-Age=0`;
  `Expires=Thu, 01 Jan 1970`); `/auth/me` afterwards 401; 6 bad logins then the
  correct password → 401 (locked), demonstrating protection.
- Web (3011): `/login` 200 with the eye control (`Rodyti slaptažodį`); no
  `localStorage`/`sessionStorage`/`Authorization` usage in web source.

## Security review

JWT secret env-only; token readable only by the server (httpOnly); no token or
password logged; generic login failures; explicit credentialed CORS; CSRF model
documented; login protection active; inactive users blocked; server-side role
enforcement unchanged.

## Limitations

- No refresh tokens (re-login on expiry) — accepted, ADR-011.
- Rate limiting is in-memory/per-instance; a shared store would be needed for
  multi-instance deployments.
- `/sandelys` contains two untracked pnpm-generated files
  (`pnpm-lock.yaml`, `pnpm-workspace.yaml`) that predate this task and are not
  part of the legacy project; not removed per the "do not modify `/sandelys`"
  constraint. No tracked `/sandelys` content changed.

## Next step

No new scope. This completes the confirmed auth foundation.
