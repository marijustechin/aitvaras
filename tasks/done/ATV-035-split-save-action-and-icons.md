# ATV-035 — Split save action and restrained icons

- **Status:** done (uncommitted; for human review)
- **Scope:** narrow warehouse-worker receiving UI follow-up
- **Depends on:** ATV-031 (worker UI), ATV-032 (units/label), ATV-033 (save → label), ATV-034 (units list)

## Objective

Split the single `Išsaugoti ir spausdinti` action into two explicit save paths
(`Išsaugoti` and `Išsaugoti ir spausdinti`), rename the units-list reprint action
to `Spausdinti`, and add restrained icons — without changing batch, bag,
reconciliation, barcode or print semantics.

## Two save flows

Both paths share one `createUnit()` (POST the unit, then refresh the batch detail),
so submission logic is not duplicated; they differ only in the resulting surface.
Each creates exactly **one** handling unit.

- **`Išsaugoti` (secondary):** validate → create → refresh batch → return
  immediately to the receiving form. Keeps the batch selected, preserves the
  batch unit and suggests the latest location, clears only the quantity, and does
  **not** open the label or call `window.print()`.
- **`Išsaugoti ir spausdinti` (primary):** validate → create → refresh batch →
  open the label surface → invoke the print flow; after `Uždaryti` it returns to
  the form with batch/location/unit preserved and quantity cleared (ATV-033).

Modelled with `applyUnitSaved(batch, bag)` (label open) and
`applyUnitSavedSilently(batch)` (form); both use `initialBagDraft(batch)`. The
pressed action is tracked in a ref; the buttons are `type="submit"` and the form
handler reads the intent (Enter defaults to the printing workflow).

## Button hierarchy

`Išsaugoti ir spausdinti` is the **primary** action (filled); `Išsaugoti` is
**secondary** (outline). Both sit in the form, in a row directly below the
location/unit/quantity inputs — no new toolbar or card.

## Icons

Lucide is **not** installed. The project already uses hand-written inline SVGs
(`PasswordInput`, `UserMenu`) with `stroke="currentColor"`, `strokeWidth="1.75"`
and `aria-hidden="true"`. Following that convention, a small `shared/ui/icons.tsx`
adds `SaveIcon`, `PrinterIcon` and `PlusIcon`; **no new dependency was added**.
Icons are decorative (aria-hidden) and always accompanied by visible text:
`Išsaugoti` → Save, `Išsaugoti ir spausdinti` → Printer, label/reprint
`Spausdinti` → Printer, `Nauja partija` → Plus.

## Reprint rename

`Spausdinti dar kartą` → **`Spausdinti`** (`REPRINT_LABEL`). The action still
reuses the existing unit and barcode and creates nothing.

## Files changed

- `features/manage-batches/lib/receiving.ts` (`SAVE_LABEL`,
  `SAVE_AND_PRINT_LABEL`, `applyUnitSavedSilently`, `REPRINT_LABEL` rename) and
  `receiving.test.ts` (+3 tests);
- `features/manage-batches/ui/receiving-page.tsx` (two save buttons + hierarchy,
  shared `createUnit`, icons);
- `shared/ui/icons.tsx` (new) and `shared/ui/index.ts`;
- docs `batches.md`, `TODO.md`; this record.

No contracts/API/DB/authorization change.

## Tests

- `save actions` (web, +3): the two action label constants; save-and-print opens
  the label while save-only stays on the form (label null); both preserve the
  batch and reset only the next quantity (unit + last location kept).
- Existing reprint test updated to expect `Spausdinti`, and still asserts it
  reuses the existing unit's label without creating one.
- No brittle icon-SVG or Tailwind-class assertions.

## Verification

- `pnpm verify` green: contracts **66**, web **184**, API **173**; lint, Prisma
  validate, typecheck, Next + Nest builds.
- `git diff --check` clean.
- No contracts/API/DB change; `/sandelys` untouched; no commit/push.

## Limitations

- Icons are hand-written inline SVGs (Lucide not installed); if the project later
  adopts Lucide, these trivially map to `Save`/`Printer`/`Plus`.
- The label surface remains an inline full-width section (ATV-033 convention).
- ATV-030…ATV-035 remain uncommitted pending review.
