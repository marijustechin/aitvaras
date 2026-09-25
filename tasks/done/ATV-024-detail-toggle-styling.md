# ATV-024 — Destructive toggle styling for detail-level actions

**Status:** done
**Date:** 2026-09-21
**Target repository:** `/aitvaras`
**Workspace ID:** O-062

## Objective

Small UI consistency fix: detail-level active/inactive toggles must use the same
approved styling as table-row toggles (O-061). No business logic, API or schema
changes.

## Audit

Searched all `Išjungti`/`Įjungti` actions. Only the **Warehouse detail** top-level
toggle still used neutral styling; all other toggles already used the shared
helper:

- `warehouse-details-page.tsx` — warehouse top-level toggle (neutral, **fixed**);
  location row toggle (already `toggleActionClass`).
- `packing-forms-page.tsx` — row toggle (already `toggleActionClass`).
- Partner detail / Resource detail — only `Redaguoti` (not a toggle); no change.
- User administration — row toggle (already `toggleActionClass`); no detail toggle.

## Changes

- `shared/lib/row-styles.ts`: parameterised `toggleActionClass(active, size)`
  where `size` is `"table"` (default, unchanged) or `"detail"` (`px-3 py-2
  text-sm`). The destructive/neutral **intent** is now defined once and shared by
  table and detail sizing, so no styling is duplicated inline. Exported
  constants (`DISABLE_ACTION_CLASS`, `ENABLE_ACTION_CLASS`) unchanged in value.
- `features/manage-warehouses/ui/warehouse-details-page.tsx`: the top-level
  warehouse toggle now uses `toggleActionClass(warehouse.active, "detail")`
  (`Išjungti` → destructive, `Įjungti` → neutral).
- Unrelated buttons (`Išsaugoti`, `Redaguoti`, `Pridėti vietą`, `Sukurti`) left
  untouched.

## Tests

`shared/lib/row-styles.test.ts` extended: detail-level active entity →
destructive class (incl. `px-3 py-2 text-sm`); detail-level inactive entity →
neutral class (no `destructive`); table sizing remains the default. Existing
label/status tests unchanged.

## Files changed

`apps/web/src/shared/lib/row-styles.ts` (+test);
`apps/web/src/features/manage-warehouses/ui/warehouse-details-page.tsx`;
`tasks/done/ATV-024-detail-toggle-styling.md`.

## Verification

- `pnpm verify` → **exit 0**. Tests: API **126 / 18**, web **88 / 15**,
  contracts **38 / 7**.
- Test-DB isolation intact (dev DB fingerprint identical before/after verify).
- Built client bundle contains `border-destructive/40`; `/warehouses` route 200.
- `git diff --check` exit 0; no secrets; `/sandelys` clean.

## Next step

None confirmed.
