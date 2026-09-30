# ATV-034 — Batch units list on the receiving screen

- **Status:** done (uncommitted; for human review)
- **Scope:** narrow warehouse-worker receiving UX follow-up
- **Depends on:** ATV-031 (worker receiving UI), ATV-032 (units/label), ATV-033 (save → label)

## Objective

On the warehouse-worker receiving page: rename the open-batch heading, and show
the selected batch's already-registered handling units below the entry form, with
a reprint action. No batch/reconciliation semantics, production movement or
authorization changes.

## Work performed

- **Heading:** `Atviros partijos` → **`Nepatvirtintos partijos`** (constant
  `UNCONFIRMED_BATCHES_HEADING`); the underlying `PENDING` status enum is
  unchanged.
- **Units list:** a new `Partijos maišai` section (`BATCH_UNITS_HEADING`) below the
  entry form, listing the selected batch's units **newest first**
  (`batchUnitsNewestFirst`, sorted by `createdAt` desc with an id tiebreak).
  Columns: `Barkodas`, `Vieta`, `Kiekis`, `Mato vnt.`, `Užregistruota` — unit-level
  only (supplier/resource/warehouse/arrival are already in the batch summary and
  are not repeated). Rows come from a compact mapper `batchUnitRow`.
- **Empty state:** `EMPTY_BATCH_UNITS_MESSAGE` =
  `Šioje partijoje dar nėra užregistruotų maišų.` (the section is never hidden).
- **Reprint:** `Spausdinti dar kartą` (`REPRINT_LABEL`) opens the label surface for
  the **existing** unit via `openLabel(state, bag)`, which reuses the exact unit
  data and changes neither the batch nor the draft — so no new unit is created and
  no new barcode is generated. It reuses the existing `BagLabel`/`bagLabelData`
  rendering, so no new print architecture was needed.
- **Flow intact:** `Išsaugoti ir spausdinti`, last-location suggestion, unit
  selection, label printing and batch-context preservation are unchanged. After a
  save the batch detail is re-fetched (already done in ATV-033), so the new unit
  appears in the list immediately on returning from the label.

## Files changed

- `features/manage-batches/lib/receiving.ts` (+ headings/empty text/reprint label,
  `batchUnitsNewestFirst`, `batchUnitRow`, `openLabel`) and `receiving.test.ts`
  (+5 tests);
- `features/manage-batches/ui/receiving-page.tsx` (heading + units section +
  reprint action);
- docs `batches.md`, `TODO.md`; this record.

No contracts/API/DB/authorization change.

## Tests

- `batch unit list` (web, +5): updated headings + empty-state text; compact row
  mapping (no batch-level fields); newest-first ordering; a newly saved unit stays
  in the refreshed list; reprint reuses the existing unit's label data without
  creating a unit or changing the batch/draft.
- No brittle CSS-class tests; print is not asserted.

## Verification

- `pnpm verify` green: contracts **66**, web **181**, API **173**; lint, Prisma
  validate, typecheck, Next + Nest builds.
- `git diff --check` clean.
- No contracts/API/DB change; `/sandelys` untouched; no commit/push.

## Limitations

- The reprint action reuses the existing label surface (inline full-width section
  that replaces the form), consistent with ATV-033; no separate print architecture.
- The units list is shown on the entry-form surface; while the label surface is
  open it is replaced (the list is visible again after `Uždaryti`).
