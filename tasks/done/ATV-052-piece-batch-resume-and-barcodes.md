# ATV-052 — PIECE batch resume + barcode-addressable groups

- **Status:** done (uncommitted; for immediate manual testing)
- **Scope:** focused correction to the uncommitted PIECE receiving slice
- **Depends on:** ATV-051 (piece-based receiving batches)

## Objective

The first manual test exposed two wrong assumptions: (1) leaving/re-entering a
delivery must not create a new PIECE batch, and (2) a PIECE item line must be a
barcode-addressable inventory group, not a transient counted row.

## 1. Resumable PENDING PIECE batches

A PIECE batch stays editable until ADMIN confirms it. The working screen moved to
its own route so re-entry restores the **same** batch:

- `/receiving/[deliveryId]` — delivery overview (`Gavimo turinys` + `Nauja
  partija`);
- `/receiving/[deliveryId]/batches/[batchId]` — the WEIGHT or PIECE working
  screen (loaded from the route param; route state, Back/refresh/bookmark work).

No P02 is allocated on leave/re-entry; a new code is created only by the explicit
`Nauja partija` action.

## 2. Actionable `Gavimo turinys`

Rows are whole-row links to the batch route (`P01 · Vienetinė · Sandėlis · kiekis
· vnt. · Būsena`); a PENDING batch opens and resumes, a CONFIRMED batch opens
read-only per role rules.

## 3. Explicit new-batch action

`Nauja partija` (on the delivery overview) chooses `Svorinė`/`Vienetinė`, then the
warehouse (WEIGHT also the resource). The overloaded `Kitas išteklius` was removed
from the working screen; returning to a batch never allocates a new code.

## 4. PIECE group barcode

`BatchItem.barcode` — a globally-unique, opaque EAN-13-shaped code (GS1 `20`
prefix + random digits + check digit), generated server-side with retry on the
unique constraint. It identifies the counted **group** (one product + quantity at
one location within one batch), not one individual piece, and encodes no business
data. Editing the `piece_batches` (uncommitted) migration; dev/test DBs had the
throwaway (barcode-less) PIECE test rows cleared before the column was added.

## 5. Label / print

PIECE group form offers `Išsaugoti` / `Išsaugoti ir spausdinti`; the group list
has `Barkodas` + `Spausdinti` reprint. A compact `PieceLabel` shows `Gavimas`,
`Partija`, `Prekė`, `Kiekis`, `Sandėlis`, `Vieta` and the barcode value + graphic.
Reprint never creates a new group, barcode or batch.

## 6. Same product behavior

Entering the same product again creates a **separate group with its own barcode**
(especially with a different location); existing barcode groups are never silently
mutated or merged.

## 7. Confirmation freeze

`POST /batches/:id/confirm-piece` keeps all group barcodes; confirmed groups are
read-only through the receiving endpoints (add/correct/void rejected), and the
quantities become the baseline for future stock operations.

## Files changed

- DB: `schema.prisma` (`BatchItem.barcode`); `piece_batches` migration.
- API: `batches/{batch.mapper,batches.service}.ts` (barcode mapping + generation).
- Contracts: `batches.ts` (`BatchItem.barcode`).
- Web: `features/manage-batches/lib/receiving.ts` (labels + `pieceLabelData`),
  `ui/receiving-delivery.tsx` (route split, resume, new-batch, barcode column,
  save/print), `ui/piece-label.tsx` (new); `app/receiving/[deliveryId]/batches/[batchId]/page.tsx`
  (new).
- Tests: `piece-batches.e2e.test.ts` (+ resume/explicit-new-batch/barcode/confirmed
  cases), `batch-form.test.ts`, `receiving.test.ts`.
- Docs: `piece-batches.md`, `TODO.md`.

## Verification

- `pnpm verify` green: lint, Prisma validate, typecheck, contracts **91** / web
  **266** / API **220**, Next + Nest builds (new route present).
- `git diff --check` clean.
- `prisma migrate diff` — no difference on dev and test DBs.
- `/sandelys` untouched; no commit/push.

## Known limitations

Dev `batch_items` test rows lacking barcodes were cleared by the schema change.
No piece-count discrepancy logic; no per-line cost allocation; no stock
move/sale/write-off yet.
