# ATV-014 — Lithuanian UI terminology cleanup

**Status:** done
**Date:** 2026-09-18
**Target repository:** `/aitvaras`
**Workspace ID:** O-049

## Objective

Standardize Lithuanian user-facing terminology: `Rolė/Rolės → Vaidmuo/Vaidmenys`
and `Statusas/Statusai → Būsena/Būsenos`. Terminology only — no behaviour,
API, database or identifier changes.

## Audit (Phase 1)

- Lithuanian role/status terms in the UI existed only as `Rolės` in three
  places; no `Rolė`, `Statusas` or `Statusai` occurred anywhere.
- `Būsena` was already used for the users status column; state values `Aktyvus`
  / `Neaktyvus` were already correct.
- The authenticated shell, login and home screens contain no role/status
  terminology. English identifiers (`roles`, `RoleKey`, `active`, `status`) are
  not rendered to users and were left unchanged.

## Changes

- `app/profile/page.tsx`: `Rolės` → `Vaidmenys`.
- `app/admin/users/page.tsx`: table header `Rolės` → `Vaidmenys`; the
  `sr-only` fieldset legend `Rolės` → `Vaidmenys`. Status header stays `Būsena`;
  `Aktyvus`/`Neaktyvus` unchanged.
- `AGENTS.md` (UI language section): recorded the durable rule — user-facing
  Role/Roles/Status/Statuses → `Vaidmuo`/`Vaidmenys`/`Būsena`/`Būsenos`, and
  legacy terms must not appear in user-facing text. Technical identifiers stay
  English.

## Unchanged (deliberately)

- `ROLE_KEYS`, `RoleKey`, `ROLE_LABELS` values (role names), API `roles`, DB
  `roles`/`user_roles`, `active`/`status` fields, enum keys.
- No dependency or infrastructure change.

## Tests

- New `apps/web/src/lib/terminology.test.ts` (4 tests): profile page uses
  `Vaidmenys`; admin users page uses `Vaidmenys`; users status column uses
  `Būsena`; and **no** `.tsx` under `app/` or `components/` renders `Rolė`,
  `Rolės`, `Statusas` or `Statusai`.
- Web suite: **14 tests / 3 files**. API **67 / 12**, contracts **4 / 1**.

## Verification

- `pnpm verify` → **exit 0**; `next build` succeeded.
- `git diff --check` → exit 0; no secrets.
- Built client JS (`apps/web/.next/static`) contains no `Rolės`, `Statusas` or
  `Statusai`.
- `/sandelys` (`alfasis-next`) has no tracked changes (`git diff --check` exit
  0).
- No commit, no push.

## Next step

None confirmed.
