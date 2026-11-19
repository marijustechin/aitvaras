# ATV-066 — Compact Gautos partijos filter panel

- **Status:** READY_FOR_HUMAN_REVIEW (uncommitted)
- **Scope:** received-batch filter panel layout and reset visibility
- **Related:** `apps/web/src/features/manage-batches/ui/gavimai-page.tsx`,
  `../lib/batch-list.ts`

## Implemented

- Desktop filter grid is now four columns (`lg:grid-cols-4`); tablet remains two
  columns and mobile one column. Reading order is unchanged:
  1. `Būsena`, `Tiekėjas`, `Išteklius`, `Sandėlis`;
  2. `Priėmimo data nuo`, `Priėmimo data iki`, `Partijos kodas`,
     `Atstatyti filtrus`.
- Reset button is a natural-width fourth item in row two, bottom-aligned with the
  date and batch-code controls.
- `Atstatyti filtrus` is rendered only when
  `hasActiveBatchFilters(filters)` is true. Comparison and reset both use
  `createBatchListFilters()` (default status `Reikia patvirtinti`, empty text
  fields), so selecting `Visos` alone reveals it and resetting hides it.
- Reset restores the defaults, clears date/code, refreshes the derived result list
  and hides the button. Returning all filters manually to defaults also hides it.
- SessionStorage restoration after visiting a batch detail still applies; button
  visibility is derived from the restored values.
- Added an explicit unit assertion that `Visos` (`ALL`) alone is an active
  filter.

## Verification

Playwright against the running app, viewport 1440:

```text
initial button count          0
initial status                NEEDS_CONFIRMATION
row 1 tops                    198 / 198 / 198 / 198
row 1 columns                 338 / 596 / 854 / 1112
after selecting Visos           button present (1)
row 2 tops                    265 / 265 / 265
row 2 columns                 338 / 596 / 854 / 1112
reset bottom-aligned          true
after reset status            NEEDS_CONFIRMATION
after reset button count      0
after reset date/code         empty / empty
```

Return from an actual batch detail (`/receipts/batches/…`) with `Visos`, code
`P01` and from-date `2026-11-01`:

```text
restored status ALL; code P01; from 2026-11-01; reset button present
```

Mobile 390 px reading order:

```text
Būsena → Tiekėjas → Išteklius → Sandėlis → Priėmimo data nuo →
Priėmimo data iki → Partijos kodas → Atstatyti filtrus
```

All fields are 290 px wide, the reset button stays 116 px natural width, and
`scrollWidth <= clientWidth` (no horizontal scrolling).

Screenshots:
- `docs/screenshots/atv-066/filters-desktop-grid.png`
- `docs/screenshots/atv-066/filters-mobile-wrap.png`

`npm run verify` passed: lint, Prisma validate, typecheck, contracts **104**,
web **283**, API **245**, builds. `git diff --check` clean.

No new screenshot-source assertion tests were added.

## Files changed

- `apps/web/src/features/manage-batches/ui/gavimai-page.tsx`
- `apps/web/src/features/manage-batches/lib/batch-list.test.ts`
- `docs/screenshots/atv-066/`
- `TODO.md`, this record

## Notes

- A post-cleanup pending batch created by `localdev` was already present when the
  browser check ran; it was used to verify real batch-detail round-trip
  restoration and was not created, modified or deleted by this task.
