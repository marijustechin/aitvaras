# ATV-017 — User administration update/disable flow and ADMIN role UX

**Status:** done
**Date:** 2026-09-21
**Target repository:** `/aitvaras`
**Workspace ID:** O-053

## Objective

Fix confirmed defects in the `Naudotojai` administration screen: user edit and
activate/deactivate failing, and missing ADMIN role semantics; plus last-active-
admin safety and more specific error messages. No unrelated architecture
change; Partneriai/Ištekliai/Pakavimo formos untouched.

## Root cause (Phase 1)

Reproduced against the local dev environment. Direct API calls
(`PATCH /users/:id` for `active` and for names/roles) returned **200** and
persisted correctly — so the failure was **not** API validation,
authorization or persistence.

The real cause was **browser CORS**: `configureApp` enabled credentialed CORS
without specifying allowed methods, and Fastify's CORS default is only
`GET,HEAD,POST` (unlike Express). A preflight `OPTIONS` for `PATCH` returned:

```text
access-control-allow-methods: GET,HEAD,POST
```

So the browser blocked every `PATCH` before it reached the API. `fetch` rejects
with a `TypeError` (not an `ApiError`), and the page collapsed it into the
generic `Nepavyko atnaujinti naudotojo` fallback. This affected **all**
browser `PATCH` flows (users, profile, partners, resources, packing forms).

## Changes

### CORS (root fix)

- `apps/api/src/bootstrap.ts`: exported `CORS_METHODS`
  (`GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS`) and `buildCorsOptions()`;
  `enableCors` now sets `methods` explicitly.
- `apps/api/src/bootstrap.test.ts` (new): unit tests for `resolveWebOrigins`
  and a regression assertion that PATCH/PUT/DELETE are allowed.

### Role normalization (Phase 5) and safety (Phase 7)

- `packages/contracts/src/roles.ts`: added `normalizeRoleKeys` — `ADMIN`
  dominates and persists alone; otherwise de-duplicated in catalogue order.
  Tests added.
- `apps/api/src/modules/users/users.service.ts`:
  - create and update normalize roles via `normalizeRoleKeys` (server-side, so
    direct API requests are covered);
  - `update(actorId, id, input)` now takes the acting user and enforces:
    - never leave zero active admins — deactivating or removing `ADMIN` from the
      last active admin → `409` with a specific Lithuanian message;
    - no self admin change (remove own ADMIN / deactivate own account) → `409`
      (documented: auth cookies are not invalidated when `active` changes);
  - duplicate-username conflict message is now Lithuanian.
- `apps/api/src/modules/users/users.controller.ts`: passes `@CurrentUser().id`
  as the actor.

### Web (`Naudotojai`)

- `apps/web/src/lib/users.ts` (new, tested): `activeToggleLabel` (`Išjungti` /
  `Įjungti`), `isRoleControlDisabled`, `toggleRoleSelection` (ADMIN dominance),
  `userAdminErrorMessage` (status → specific Lithuanian), `applyUserUpdate`,
  `userEditSuccess`.
- `apps/web/src/app/admin/users/page.tsx`:
  - role controls disabled (and others unchecked) while `Administratorius` is
    selected; re-enabled when unchecked (no auto-restore);
  - action label `Įjungti` for inactive users (was `Aktyvuoti`);
  - specific error mapping (authz/validation/not-found/conflict/server) with a
    safe fallback and dev-only `console.error` context;
  - after save: row replaced from the returned user, edit panel closed, stale
    error cleared (no reload); after activate/deactivate: row replaced
    immediately.

## Tests

- API `users.e2e.test.ts` (extended): CORS preflight allows PATCH; unauth/non-
  admin mutation rejected; admin updates names+roles without touching another;
  ADMIN+role → ADMIN-only on create and update; empty roles rejected (create and
  update); deactivate/reactivate; last active admin cannot be deactivated or
  lose ADMIN (`409` + messages); removing ADMIN allowed when another active
  admin exists; 404 unknown id.
- Web `lib/users.test.ts` (new, 11): ADMIN clears/disables others; unchecking
  re-enables; `Išjungti`/`Įjungti`; error mapping incl. conflict passthrough;
  row replacement + cleared edit session.
- Contracts: `normalizeRoleKeys` tests.
- Totals: **API 106 / 16 files, web 45 / 6 files, contracts 26 / 5 files.**

## Verification

- `pnpm verify` → **exit 0**.
- Test-DB isolation intact: dev DB users fingerprint identical before/after the
  API suite.
- Live preflight after fix:
  `access-control-allow-methods: GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS`.
- Smoke (dev API): last-admin deactivate/role-removal → `409` with the exact
  Lithuanian messages; assigning `ADMIN`+`WAREHOUSE_WORKER` persisted `ADMIN`
  only; restore; deactivate → `active=false`; reactivate → `active=true`;
  `/partners`, `/resources`, `/auth/me` still 200; logout 200. The test user
  (`jonaitis`) was restored to `WAREHOUSE_WORKER` / active.
- `git diff --check` exit 0; no secrets; `/sandelys` clean.

## Notes

- Self-deactivation is **rejected** (rather than allowed) because JWT auth does
  not re-check `active`, so allowing it would leave an authenticated-but-inactive
  session. Documented in `docs/authorization.md`.
- The CORS fix also repairs browser `PATCH` for profile, partners, resources and
  packing forms.

## Next step

None confirmed.
