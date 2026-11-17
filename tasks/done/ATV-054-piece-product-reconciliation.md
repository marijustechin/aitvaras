# ATV-054 — PIECE product-by-product reconciliation

- **Status:** done (uncommitted; for immediate manual testing)
- **Scope:** focused correction to the uncommitted PIECE receiving slice
- **Depends on:** ATV-051/052/053 (piece-based receiving)

## Objective

PIECE confirmation must reconcile documentary quantities **per product**, not only
confirm one total piece count. A mismatch on one product does not change the
physical quantity and does not block confirmation.

## 1. Wording

PIECE confirmation uses `Faktiškai užregistruota` (counted) instead of
`Faktiškai susverta`; no kg/tare/weight controls appear. WEIGHT UI unchanged.

## 2. Aggregation

The server aggregates ACTIVE PIECE groups by resource (the same product in several
groups/locations is one row; voided groups excluded). The client never sends
actual quantities or differences.

## 3. Confirmation table

`Prekė | Faktiškai | Sutampa | Dokumentuose | Skirtumas`. `Faktiškai` is
read-only; `Sutampa` (default checked) sets `Dokumentuose` = actual and disables
the input; unchecked lets the ADMIN enter the supplier quantity (non-negative
integer). Signed `differencePieces = actualPieces − documentPieces`, with rose
emphasis on mismatch.

## 4. Persistence

New `PieceReconciliationLine` (`id`, `batchId`, `resourceId`, `actualPieces`
snapshot, `documentPieces`, `differencePieces`, `createdById`, `createdAt`;
`@@unique([batchId, resourceId])`). `actualPieces` is derived server-side. The
committed `Batch.documentPieces` is left as-is for WEIGHT and is not used for
PIECE (no competing truth).

## 5. Discrepancy model extension

`ReceivingDiscrepancy` gains `kind` (`WEIGHT`|`PIECE`), nullable `resourceId`,
nullable weight columns, and `actualPieces`/`documentPieces`/`differencePieces`.
The unique `batchId` becomes a plain index (WEIGHT keeps one-per-batch by
convention; PIECE is per product). **Forward migration** `piece_reconciliation`
(the `receiving_discrepancies` table is committed). Existing WEIGHT data
preserved.

## 6. Confirmation behaviour

All match → CONFIRMED, no discrepancy. Any mismatch without
`acknowledgeDiscrepancies` → `400 DISCREPANCY_NOT_ACKNOWLEDGED`, no state change.
With acknowledgement → transaction: one `PieceReconciliationLine` per product,
one PIECE `ReceivingDiscrepancy` per non-zero product, batch acquisition amount +
document date/number, batch → CONFIRMED. The status-flip guards retries (no
duplicate lines/discrepancies).

## 7. Reports / settlement boundary

PIECE discrepancies appear in `Ataskaitos → Neatitikimai` with the product and a
signed `vnt.` difference; WEIGHT keeps kg. PIECE detail shows origin + signed
`vnt.`, does **not** show the weight-settlement form (settlement of PIECE
discrepancies is not defined). Settlement API rejects PIECE
(`PIECE_SETTLEMENT_NOT_SUPPORTED`). WEIGHT settlement unchanged.

## 8. Cost pool

One batch acquisition amount / cost pool; product-level cost allocation is
explicitly deferred (the facts are preserved for a later allocation).

## Files changed

- DB: `schema.prisma`; migration `20260930170000_piece_reconciliation`.
- Contracts: `receiving-discrepancies.ts` (kind + pieces), `batches.ts`
  (`PieceReconciliationRow/Line`, reused by `BatchDetail.pieceReconciliation`,
  per-product confirm request/result) (+ tests).
- API: `batches/{batch.mapper,batches.service,batches.controller}.ts`,
  `receiving-discrepancies/{discrepancy.mapper,receiving-discrepancies.service}.ts`,
  `test/piece-batches.e2e.test.ts`.
- Web: `entities/batch/batch.ts` (`formatSignedPieces`),
  `features/manage-batches/lib/batch-form.ts`
  (+test), `ui/batch-details-page.tsx`;
  `features/manage-discrepancies/{lib/discrepancy-list.ts,ui/discrepancies-page.tsx,ui/discrepancy-details-page.tsx}`
  (+test).
- Docs: `piece-batches.md`, `discrepancies.md`, `domain-glossary.md`,
  `architecture.md`, `TODO.md`.

## Verification

- `pnpm verify` green: lint, Prisma validate, typecheck, contracts **91** / web
  **274** / API **224**, Next + Nest builds.
- `git diff --check` clean.
- `prisma migrate diff` — no difference on dev and test DBs.
- `/sandelys` untouched; no commit/push.

## Deferred

PIECE discrepancy settlement (pieces/money/replacement definitions); per-line cost
allocation; piece-count discrepancy tolerance rules.
