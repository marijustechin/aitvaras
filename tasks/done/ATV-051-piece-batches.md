# ATV-051 — Piece-based receiving batches (Vienetinės partijos)

- **Status:** done (uncommitted; for immediate manual testing)
- **Scope:** a vertical slice so a real PIECE delivery can be entered today
- **Depends on:** ATV-042…ATV-050 receiving/packaging/discrepancy slice

## Objective

A Batch can now be received by `WEIGHT` (existing) or `PIECE`. A PIECE batch is
the cost/provenance pool for several products received as integer item lines —
no packages, tare, weight or barcode — while the WEIGHT flow is unchanged.

## 1. Batch receiving mode

`enum BatchReceivingMode { WEIGHT, PIECE }` on `Batch` (`@default(WEIGHT)`);
labels `Svorinė`/`Vienetinė`. A property of the concrete Batch, not of the
resource. Existing batches migrate to `WEIGHT`.

## 2. Batch resource ownership

`Batch.resourceId` is now **nullable**: required for WEIGHT (domain validation),
absent for PIECE (resources live on the item lines). No fake "mixed goods"
resource.

## 3. PIECE item model (`BatchItem`)

`id`, `batchId`, `resourceId`, `warehouseLocationId`, `quantity` (positive
integer), `status` (`ACTIVE`/`VOIDED`), `voidedBy/voidedAt/voidReason`,
`createdById`, timestamps. One PIECE batch may contain many resources; the same
product may appear in multiple locations. No package/barcode rows are used.

## 4. Cost/provenance pool

The batch keeps the total acquisition amount; the purchase value is **not**
allocated to product lines. The `batchId` lineage stays explicit for future
sales/write-offs.

## 5. Receiving UI

Starting a batch first chooses `Partijos tipas` (`Svorinė`/`Vienetinė`). Svorinė →
resource + warehouse + the existing flow. Vienetinė → warehouse only, then
`Vienetinė partija P01` with `Prekės pavadinimas`, `Kiekis, vnt.`, `Vieta`,
`Pridėti`, the item table and `Iš viso: N vnt.` No tare/weight/barcode controls.

## 6. Product dropdown + quick-create

The existing `Resource` master is reused (no second product master). `+ Nauja
prekė` opens a minimal name + category form using `POST
/resources/receiving-quick-create` (ADMIN/WAREHOUSE_WORKER), which does **not**
grant broad resource administration; the new product is selected automatically.

## 7. Item correction / void

While PENDING: change quantity/location; void a line (kept, with reason/voidedBy).
A CONFIRMED batch is frozen. Focused mechanism, no generic audit framework.

## 8. PIECE confirmation

Separate `POST /batches/:id/confirm-piece` (ADMIN): actual total pieces
(server-derived, read-only), acquisition amount, optional document date/number.
No measured/document weight, no tare, no discrepancy acknowledgement. The batch
becomes CONFIRMED; item quantities remain the inventory truth; the acquisition
amount stays on the batch.

## 9. Discrepancy boundary

PIECE confirmation never creates a `ReceivingDiscrepancy`; WEIGHT keeps the
existing logic.

## 10. Admin display

`Gavimai`/batch detail show the mode. WEIGHT shows package count/net weight; PIECE
shows product line count and total pieces (no `0 kg`).

## 11. API / contracts

`ResolveBatchRequest` accepts `receivingMode` (default WEIGHT) + optional
resource; item add/list/correct/void endpoints; `POST /batches/:id/confirm-piece`;
`POST /resources/receiving-quick-create`. Contracts add `BatchReceivingMode`,
`BatchItem` (+ statuses), `CreateBatchItemRequest`, `UpdateBatchItemRequest`,
`VoidBatchItemRequest`, `ConfirmPieceBatchRequest`, `BatchPieceConfirmation`,
`QuickCreateResourceRequest`, and nullable batch resource + `itemLineCount`/
`totalPieces`; `BatchDetail.items`. Server enforces mode invariants (WEIGHT
requires resource + rejects items; PIECE rejects packages/weights; integer
quantities; locations in the batch's warehouse; CONFIRMED immutable).

## Files changed

- DB: `schema.prisma`; migration `20260930160000_piece_batches`.
- Contracts: `batches.ts`, `incoming-deliveries.ts`, `resources.ts` (+ tests).
- API: `batches/{batch.mapper,batches.service,batches.controller}.ts`;
  `resources/{resources.controller,resources.service}.ts`;
  `test/piece-batches.e2e.test.ts`.
- Web: `entities/batch/batch.ts`; `features/manage-batches/lib/{batch-form,receiving,batch-list}.ts`
  (+ tests); `ui/{receiving-delivery,gavimai-page,batch-details-page}.tsx`.
- Docs: `piece-batches.md` (new), `batches.md`, `scope.md`, `domain-glossary.md`,
  `architecture.md`, `authorization.md`, `AGENTS.md`, `README.md`, `TODO.md`.

## Verification

- `pnpm verify` green: lint, Prisma validate, typecheck, contracts **91** / web
  **264** / API **218**, Next + Nest builds.
- `git diff --check` clean.
- `prisma migrate diff` — no difference on dev and test DBs.
- `/sandelys` untouched; no commit/push.

## Known limitations

No piece-count discrepancy logic; no per-line cost allocation; no label/barcode
for PIECE; server-side register filtering/pagination unchanged. `PIECE` always
starts a new capture batch (a delivery may hold several).
