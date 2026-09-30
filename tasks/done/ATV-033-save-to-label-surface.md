# ATV-033 — Save goes straight to the label surface

- **Status:** done (uncommitted; for human review)
- **Scope:** narrow warehouse-worker UX follow-up on the `/receiving` flow
- **Depends on:** ATV-031 (worker receiving UI), ATV-032 (units/location/label)

## Objective

Eliminate the intermediate step between saving a handling unit and printing its
label: `Išsaugoti ir spausdinti` must persist the unit and then go **directly to
the label surface** (no detail page / no extra click), and closing the label must
return to the same receiving form with the batch and last-used location preserved
and only the quantity reset. No API, data-model or authorization changes.

## Previous flow

On `/receiving`, saving a unit persisted it, showed the label **inline below the
form** (so the form stayed visible alongside it), auto-invoked `window.print()`,
and kept a manual `Spausdinti` button in the inline block. There was no explicit
"finish label" action returning to the form, and the form remained on screen
during the label step.

## New flow

1. Worker fills the unit form (`Vieta`, `Vienetas`, `Kiekis`).
2. Presses **`Išsaugoti ir spausdinti`**.
3. The unit is persisted; the batch detail is refreshed.
4. The **label surface replaces the form** immediately (same `/receiving` route —
   no navigation, no intermediate detail page) and the browser print preview is
   invoked from it.
5. The label shows `Sandėlis`, `Vieta`, `Kategorija`, `Rūšis`, `Partija`, the
   quantity with unit and the barcode (value + EAN-13 graphic), plus a single
   `Spausdinti` fallback and a `Uždaryti` action.
6. Closing the label returns to the same form: the batch stays selected, the
   unit is kept, the last-used location stays suggested, and **only the quantity
   is reset** (focus returns to the quantity field).

## Print behaviour

The browser-native print dialog is invoked **automatically** from the label
surface after a successful save (`window.print()` in an effect keyed on the saved
unit), with **no** application-level confirmation step in between. Because an
automatic invocation can occasionally be blocked, the label surface keeps a
**single** `Spausdinti` action as the manual fallback. No printer-driver or
hardware integration.

## Error handling

If the save fails, the label is **not** opened; the existing actionable
validation/API message is shown and the entered form data (location, unit,
quantity) is preserved.

## State model (pure, testable)

The bag-mode state is modelled in `features/manage-batches/lib/receiving.ts`:

- `BAG_SURFACES = ["form", "label"]` — deliberately **no** `detail` surface;
- `initialBagModeState()`, `enterBagMode(batch)`;
- `applyUnitSaved(batch, bag)` — opens the label and prepares the next draft
  (`initialBagDraft(batch)`: same unit, last-used location, quantity reset);
- `applyUnitSaveFailed(current)` — keeps the draft and never opens a label;
- `closeLabel(current)` — clears the label, preserving batch + next draft;
- `bagSurface(state)` — `"label"` when a saved unit is present, else `"form"`.

## Files changed

- `features/manage-batches/lib/receiving.ts` (+state helpers) and
  `receiving.test.ts` (+7 state tests);
- `features/manage-batches/ui/receiving-page.tsx` (bag-mode state refactor +
  label surface + close action; auto-print kept);
- docs `batches.md`, `TODO.md`; this record.

No contracts/API/DB change.

## Tests

- `bag mode state` (web, +7): only `form`/`label` surfaces (no `detail`);
  initial form state; entering a batch; **a successful save goes straight to the
  label**; closing returns to the form preserving batch + next draft; next draft
  keeps unit + location and resets quantity; **a failed save never opens the
  label and keeps the draft**.
- No brittle print-dialog/browser-native tests (print is invoked via
  `window.print()`; not asserted).

## Verification

- `pnpm verify` green: contracts **66**, web **176**, API **173**; lint, Prisma
  validate, typecheck, Next + Nest builds.
- `git diff --check` clean.
- No API/data-model/authorization change; `/sandelys` untouched; no commit/push.

## Limitations

- Browser print still relies on `window.print()`; if the environment blocks the
  automatic dialog, the single `Spausdinti` action on the label surface is the
  fallback.
- The label surface is an inline full-width section, not a modal overlay; it
  replaces the form rather than floating over it (chosen for simplicity and
  print reliability).
