# ATV-013 — Application shell, sticky top navigation and user profile

**Status:** done
**Date:** 2026-09-18
**Target repository:** `/aitvaras`
**Workspace ID:** O-048

## Objective

Give Aitvaras an application feel after login: a reusable authenticated shell
with a compact sticky top bar, role-aware navigation, a current-user menu, and
self-service profile editing (names + password). No warehouse/domain features.

## Implementation

- **Shell** (`components/layout/app-shell.tsx`): `RequireAuth` + sticky
  `AppHeader` + content `<main>`; the root-layout footer stays in normal flow.
  Authenticated pages use it; header markup is not duplicated per page.
- **Header** (`app-header.tsx`): `sticky top-0 z-40`, `h-14`, bottom border,
  `bg-background`; `BrandMark href="/"` (symbol narrow / horizontal wide).
- **Navigation** (`main-navigation.tsx` + `lib/navigation.ts`): `Pradžia` for
  all; `Naudotojai` (`/admin/users`) only for `ADMIN`. Active state via
  `usePathname` with a thin bottom indicator; nested `/admin/users/*` marks
  `Naudotojai` active. **No placeholder items** for future domains.
- **User menu** (`user-menu.tsx`): shows `Vardas Pavardė` (icon on mobile),
  opens an accessible `role="menu"` with `Mano profilis` and `Atsijungti`;
  closes on selection, outside click and Escape; logout calls the API and
  returns to `/login`.
- **Profile** (`app/profile/page.tsx`): two sections — account info (editable
  `Vardas`/`Pavardė`, read-only username, read-only roles via Lithuanian
  `ROLE_LABELS`) and `Keisti slaptažodį` (current + new + confirm, with
  accessible show/hide controls). After a name save the auth context is updated
  (`replaceUser`) so the header reflects it without re-login.
- **Reusable `PasswordInput`** (`components/password-input.tsx`) with correct
  eye semantics; the login page now uses it too (same behaviour as before).
- **API**: authenticated `PATCH /auth/me` (`UpdateOwnProfileRequestSchema`).
  Updates only the current user (id from the session; client never sends an id):
  `firstName`/`lastName` (trimmed, non-empty, ≤100) and password change
  requiring the current password. The schema is strict: `roles`, `active` and
  `username` are rejected (`400`). Wrong current password → `400`. Returns the
  updated safe user; passwords are never returned or logged.
- **Home** (`/`): simplified to a welcome state (`Sveiki, …`); redundant
  account/debug UI removed.

## Files changed

`apps/api`: `modules/auth/{auth.controller.ts,auth.service.ts}`,
`test/profile.e2e.test.ts` (new).
`packages/contracts/src/auth.ts`.
`apps/web`: `components/layout/{app-shell,app-header,main-navigation,user-menu}.tsx`
(new), `components/password-input.tsx` (new), `components/auth-provider.tsx`,
`lib/navigation.ts` (+`navigation.test.ts`) (new), `app/login/page.tsx`,
`app/page.tsx`, `app/profile/page.tsx` (new), `app/admin/users/page.tsx`.
Docs: `README.md`, `AGENTS.md`, `docs/{architecture,authentication,authorization,branding}.md`.
Task trail: `tasks/done/ATV-013-application-shell-and-profile.md`.

## Tests

- API: `profile.e2e.test.ts` — unauth rejected; name update reflected by
  `/auth/me`; roles/active/username rejected and unchanged; wrong current
  password → 400; correct change → old password fails, new succeeds; self-profile
  does not affect another user.
- Web: `navigation.test.ts` — `Pradžia` for all, `Naudotojai` only for ADMIN,
  no unconfirmed items, active-state resolution (incl. nested).
- Totals: **67 API tests / 12 files** and **10 web tests / 2 files** pass.

## Verification

- `pnpm verify` → **exit 0**; `next build` routes include `/profile`.
- Live smoke (API 3010): rename via `PATCH /auth/me` reflects in `/auth/me`;
  `roles` → 400; password change 200; old password → 401, new → 200. Then
  `pnpm seed:dev` restored `localdev` / `localdev` (login 200 confirmed).
- Test-DB isolation intact: dev `localdev` fingerprint/count identical before and
  after `pnpm verify`; tests ran on `aitvaras_test`.
- Web (3011): `/`, `/profile`, `/login`, `/admin/users` → 200; `Mano profilis`
  present in the built client JS; sticky header present in source. Servers
  stopped.
- `git diff --check` clean; no secrets.

## Limitations

- Desktop and mobile share the compact header (symbol logo and a user icon on
  narrow widths); the two navigation items remain visible at all sizes.
- No avatar/email/preferences (not confirmed).
- `/sandelys` unchanged.

## Next step

None confirmed.
