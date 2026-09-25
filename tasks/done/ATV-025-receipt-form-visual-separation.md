# ATV-025 — Visually separate receipt form from receipt history

**Status:** done
**Date:** 2026-09-21
**Target repository:** `/aitvaras`
**Workspace ID:** O-063

## Objective

Small UI polish only: on the `Pajamavimas` page, make the active receipt-entry
form stand apart from the historical `Pajamavimai` list. No business logic, API,
schema or receipt validation changes.

## Change

- `features/manage-receipts/ui/receipts-page.tsx`: the receipt-entry card
  (`Partneris`, lines, `+ Pridėti eilutę`, total, `Išsaugoti`) background changed
  from `bg-card` to the existing neutral surface token **`bg-muted`** (the
  closest design-system surface to the requested `bg-slate-50`; the project has
  no `slate` palette). Rounded border, spacing, typography, layout and the black
  primary `Išsaugoti` button are unchanged; no shadow, gradient or new accent
  colour.
- The `Pajamavimai` history section was left plain (default/white background);
  its table styling was not changed.

Result: **forma = active work area** (subtle light grey); **sąrašas =
historical/reference area** (plain).

## Contrast / consistency

- Inputs/selects keep `bg-background` (white) on the grey card, so input contrast
  is preserved; disabled selects remain legible.
- Borders and controls keep their existing colours; the treatment stays within
  the minimalist monochrome design and the existing `muted` token.

## Files changed

`apps/web/src/features/manage-receipts/ui/receipts-page.tsx`;
`tasks/done/ATV-025-receipt-form-visual-separation.md`.

## Verification

- `pnpm verify` → **exit 0**. Tests: API **126 / 18**, web **88 / 15**,
  contracts **38 / 7** (no test changes needed for a presentational class).
- Test-DB isolation intact (dev DB fingerprint identical before/after verify).
- Built client bundle references `bg-muted`.
- `git diff --check` exit 0; no secrets; `/sandelys` clean.

## Next step

None confirmed.
