# ATV-042 — Incoming deliveries (Gavimas) with multiple resource batches

- **Status:** done (uncommitted; for human review)
- **Scope:** receiving-slice architecture — a top-level delivery entity above batches
- **Depends on:** ATV-029…ATV-041 (batches/bags, reconciliation, corrections)

## Objective

Model the confirmed real workflow: one physical supplier arrival (**Gavimas**)
contains several resources; supplier + arrival date apply to the whole arrival;
**each resource goes into one warehouse per batch**, so one delivery may span
warehouses; physical stock always arrives in packages and is received by **actual
weight** (no KG/PCS unit); the ADMIN may additionally record an optional
documentary piece count. The worker flow becomes delivery-centric. No long-lived
discrepancy register; no vehicle modelling; no unrelated UI polish.

## 1. IncomingDelivery model (`Gavimas`)

`IncomingDelivery`: `id`, `code` (`GYYMM-NN`, unique), `supplierId`,
`arrivalDate`, `createdById`, timestamps. **No `warehouseId`** (a delivery spans
warehouses); **no transport/vehicle entity**. `IncomingDelivery 1 → many Batch`.

## 2. Batch owns the warehouse

`Batch`: `deliveryId`, `resourceId`, `warehouseId`, internal `code`, `status`,
reconciliation fields, plus `@@unique([deliveryId, resourceId, warehouseId])`. A
batch is exactly one resource into one warehouse; the same resource into different
warehouses is different batches. Supplier + arrival date are inherited from the
delivery (not duplicated). Warehouse locations are constrained to the batch's
warehouse.

## 3. Weight-based physical receiving (PCS removed)

`Bag` (physical package): `weight` (Decimal 14,3) only — the KG/PCS unit was
removed everywhere (`HandlingUnitKey` enum dropped, `Batch.unit` removed,
`bags.quantity` renamed to `bags.weight`, unit selectors removed from contracts/UI,
correction kind `QUANTITY` → `WEIGHT`). Packages always store an actual weight;
even conceptually counted goods are received by weight.

## 4. Optional documentary piece count

`Batch.documentPieces Int?` (nullable positive integer). Reconciliation accepts an
optional `documentPieces`; it is additional documentary/business information — it
does not replace document weight, does not replace measured weight, does not drive
package/batch totals, and there is no per-package allocation. Example: measured
`186.400 kg`, document `188.000 kg`, `500` pieces.

## 5. Receiving UI

- Start form **`Naujas gavimas`**: `Tiekėjas` + `Atvykimo data` only (no warehouse,
  no resource; code system-generated); action **`Pradėti gavimą`**.
- Inside a delivery: **`Registruojama rūšis`** = `Išteklius` + `Sandėlis` +
  `Pradėti registruoti` (no unit). Creating/selecting creates/resolves one batch
  for (delivery, resource, warehouse).
- Package entry: `Vieta` + `Svoris`, actions `Išsaugoti` /
  `Išsaugoti ir spausdinti`; the active resource/batch + last location are kept and
  only the weight resets. **`Kitas išteklius`** starts another batch in the same
  delivery. Multi-resource + multi-warehouse supported.
- `Gavimo turinys` summary: resource, warehouse, active count, total weight,
  status.
- Label: `Gavimas: GYYMM-NN` + warehouse, location, category, resource, actual
  weight, barcode (no PCS, no internal batch code).

## 6. ADMIN reconciliation

Form now: measured weight, document weight, optional `Dokumentiniai vienetai`,
acquisition amount, document date, document number, difference. Existing
discrepancy state behaviour unchanged (the long-lived register is still out of
scope).

## 7. Migration (rewritten, uncommitted)

The ATV-042 migration was **rewritten in place** (no stacking) so it directly
represents the corrected target from `0b8b5bc`:
create `incoming_deliveries` (supplier + arrival, no warehouse); backfill one
delivery per existing batch (id = batch id, per-month `GYYMM-NN`); add
`batches.delivery_id` + `document_pieces`, keep `warehouse_id`, drop
`supplier_id`/`arrival_date`; rename `bags.quantity → weight`, drop `bags.unit`,
rename `BagCorrectionKind` value `QUANTITY → WEIGHT`, drop `HandlingUnitKey`.
Because the old migration was already applied to the local dev/test DBs, both were
**reset/rebuild** via the project workflow (`prisma migrate reset --force` on dev
+ `pnpm db:test:reset`, then `pnpm seed:dev`/`seed:reference`) so migration history
matches. Migration drift check is clean on both DBs.

## Contracts / API

`CreateIncomingDeliveryRequestSchema` = supplier + arrival date;
`ResolveBatchRequestSchema` = resource + warehouse; `CreateBagRequestSchema` =
`weight` + location; `BatchSchema` = no unit, `totalWeight`, `documentPieces`,
warehouse; `ReconcileBatchRequestSchema` = + optional `documentPieces`.
Endpoints: `POST/GET /deliveries`, `GET /deliveries/:id`,
`POST /deliveries/:id/batches`; removed `POST /batches`.

## Files changed

- DB: `schema.prisma`; migration `20260930100000_incoming_deliveries` (rewritten).
- Contracts: `batches.ts`, `incoming-deliveries.ts` (+tests), `index.ts`.
- API: `modules/batches/{batch.mapper,batches.service,batches.controller,deliveries.controller,batches.module}.ts`,
  `delivery-code.ts` (+test), `test/batches.e2e.test.ts`.
- Web: `entities/batch/batch.ts` (+test);
  `features/manage-batches/lib/{batch-form,receiving}(+tests)`,
  `ui/{receiving-page,gavimai-page,batch-details-page,bag-label}.tsx`,
  `lib/batch-list.test.ts`.
- Docs: `batches.md`, `domain-glossary.md`, `scope.md`, `authorization.md`,
  `AGENTS.md`, `TODO.md`; this record.

## Verification

- `pnpm verify` green: lint, Prisma validate, typecheck, contracts **75** / web
  **195** / API **186**, Next + Nest builds.
- `git diff --check` clean.
- `prisma migrate diff --from-config-datasource --to-schema` — no difference on
  both the dev and test databases.
- `/sandelys` untouched; no commit/push.

## Known limitations

- Migrated deliveries are one-per-batch (historical shared arrivals cannot be
  proven); documented in `docs/batches.md`.
- Vehicles/transport, package split/merge, per-package piece allocation and
  post-confirmation corrections are out of scope; internal `Bag` naming unchanged.
