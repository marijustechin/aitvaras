# ATV-023 — Inactive row styling and destructive disable actions

**Status:** done
**Date:** 2026-09-21
**Target repository:** `/aitvaras`
**Workspace ID:** O-061

## Objective

UI consistency/polish only: de-emphasize inactive rows, use destructive styling
for the `Išjungti` action and neutral styling for `Įjungti`. No business logic,
API or schema changes.

## Changes

- New `apps/web/src/shared/lib/row-styles.ts` (+ test):
  - `inactiveRowClass(active)` → `""` for active rows, `text-muted-foreground`
    for inactive rows (deliberate muted text, not row opacity, so controls stay
    legible);
  - `DISABLE_ACTION_CLASS` → restrained destructive (`text-destructive`,
    `border-destructive/40`, `hover:bg-destructive/10`, focus-visible ring) using
    the existing design-system `destructive` token;
  - `ENABLE_ACTION_CLASS` → neutral (border + `hover:bg-accent`), never green;
  - `disableActionClass()`, `enableActionClass()`, `toggleActionClass(active)`.
- Applied consistently:
  - **Naudotojai** (`manage-users`): inactive rows muted; the activate/deactivate
    button uses `toggleActionClass` (destructive `Išjungti`, neutral `Įjungti`).
  - **Partneriai**, **Ištekliai**, **Sandėliai**: inactive rows muted.
  - **Sandėlio vietos** (`manage-warehouses` detail): inactive rows muted; toggle
    uses `toggleActionClass`.
  - **Pakavimo formos**: inactive rows muted; toggle uses `toggleActionClass`,
    and the label was aligned from `Aktyvuoti` to **`Įjungti`** for consistency
    with the other tables.
- Status text unchanged: `Aktyvus` / `Neaktyvus` (muted via the row treatment,
  never red). Red is reserved for the disabling action.

## Accessibility

- Destructive and neutral buttons keep `focus-visible:ring-2` styling.
- Inactive state is conveyed by the `Būsena` column text (`Neaktyvus`) as well as
  the muted row, not by colour alone.
- No row-level opacity, so interactive controls remain readable.

## Files changed

`apps/web/src/shared/lib/row-styles.ts` (+test);
`apps/web/src/features/manage-users/ui/users-page.tsx`;
`apps/web/src/features/manage-partners/ui/partners-page.tsx`;
`apps/web/src/features/manage-resources/ui/resources-page.tsx`;
`apps/web/src/features/manage-warehouses/ui/{warehouses-page.tsx,warehouse-details-page.tsx}`;
`apps/web/src/features/manage-packing-forms/ui/packing-forms-page.tsx`;
`tasks/done/ATV-023-inactive-row-and-destructive-actions.md`.

## Verification

- `pnpm verify` → **exit 0**. Tests: API **126 / 18**, web **85 / 15**,
  contracts **38 / 7**.
- Focused tests (`row-styles.test.ts`): inactive rows muted, active rows not;
  `Išjungti` destructive; `Įjungti` neutral; focus-visible kept. Labels verified
  unchanged/consistent (`activeToggleLabel` and `activeStatusLabel` tests).
- Test-DB isolation intact (dev DB fingerprint identical before/after verify).
- Built client bundle contains `border-destructive/40` and
  `text-muted-foreground`; labels `Išjungti`/`Įjungti` present; legacy
  `Aktyvuoti` gone; admin/list routes 200.
- `git diff --check` exit 0; no secrets; `/sandelys` clean.

## Next step

None confirmed.
