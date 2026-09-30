# ATV-032 — Handling-unit quantities, required location & label

- **Status:** done (uncommitted; for human review)
- **Scope:** focused follow-up on the ATV-029/030/031 receiving model
- **Depends on:** ATV-029 (batches/bags), ATV-030 (reconciliation), ATV-031 (worker UI)

## Objective

Generalise the handling unit from a weight-only bag to a **quantity + measurement
unit** (`KG`/`PCS`), require a warehouse location, remember the last-used location
for the batch, rename the save action to `Išsaugoti ir spausdinti`, and complete
the label (warehouse, location, category, resource, batch, quantity, barcode
value + graphic). No production-transfer or new reconciliation semantics.

## Data-model change

Handling units now carry `quantity` + `unit` instead of a bare weight, and a
physical unit must be placed:

- `HandlingUnitKey { KG, PCS }` (new enum);
- `Bag.quantity Decimal(14,3)` (renamed from `weight`);
- `Bag.unit HandlingUnitKey @default(KG)`;
- `Bag.warehouseLocationId` is now **required** (`NOT NULL`) with
  `ON DELETE RESTRICT` on the location.

`Batch` is unchanged; its `unit` is **derived** from the first unit and
`totalQuantity` from the sum of unit quantities. Reconciliation stays weight-based
(`KG` only). No second category field: the label category comes from the
resource's managed `ResourceCategory` (`Batch.resourceCategoryName`).

## Migration strategy (`handling_unit_quantity`)

Hand-written, safe on existing data:
1. create the `HandlingUnitKey` enum;
2. `RENAME COLUMN weight TO quantity` (preserves every measured value);
3. add `unit ... NOT NULL DEFAULT 'KG'` (existing rows become KG);
4. drop/re-add the location FK as `ON DELETE RESTRICT` and `SET NOT NULL`.

Applied with `prisma migrate deploy` (interactive `migrate dev` is blocked by the
NOT NULL warning). Verified on the dev DB: the 4 existing units kept their values
as `quantity`, `unit = KG`, with their locations intact.

## Measurement-unit rules

- `KG` accepts positive decimals (3-decimal convention); `PCS` accepts positive
  whole units only — fractional `PCS` is rejected, never silently rounded.
- Default `KG`.
- **One unit per batch:** the first unit establishes the batch unit and every
  later unit must match (`UNIT_MISMATCH`, 400); `GET /batches/:id` reports the
  batch `unit`. A batch never mixes kilograms and pieces.
- Contract validation (`CreateBagRequestSchema`) requires a location
  (`Pasirinkite sandėlio vietą.`), defaults the unit to `KG`, and `superRefine`s
  `PCS` to integers; the API re-validates and enforces unit consistency.

## Required-location enforcement

- Contracts: `warehouseLocationId` is a required UUID with a friendly Lithuanian
  message.
- API: `assertLocationInWarehouse` always runs (exists, active, belongs to the
  batch warehouse).
- DB: `NOT NULL` + `ON DELETE RESTRICT`.
- Web: the location select is `required`, with no "no location" option.

## Last-location behaviour

`BatchDetail.suggestedLocationId` is the location of the **most recently
registered unit** of the batch (derived from persisted data, so it survives
refreshes and works across workstations). The receiving form preselects it for the
next unit (`initialBagDraft`) and the worker may still change it; with no previous
unit the location stays unselected (no arbitrary fallback).

## Save-and-print

The worker flow's primary action is **`Išsaugoti ir spausdinti`**: validate →
create the unit → receive the barcode → render the label → invoke the browser
print preview (`window.print()`), then leave the form ready for the next unit
(focus returns to the quantity field). No printer-driver/hardware integration;
relies on the existing browser print flow.

## Label contents

`BagLabel` now shows `Sandėlis`, `Vieta`, `Kategorija`, `Rūšis` (resource),
`Partija`, quantity with unit (`48.725 kg` / `12 vnt`) and the barcode (value +
**scannable EAN-13 graphic**, rendered client-side from a small pure encoder in
`shared/lib/ean13.ts`). The barcode remains the only machine value and encodes no
batch metadata.

## Reconciliation compatibility

Reconciliation remains weight-based and applies to **`KG`** batches only:
`measuredWeight = SUM(bags.quantity)` over the batch's KG units; a `PCS` batch is
rejected with `BATCH_NOT_WEIGHT`, and pieces are never summed into kilograms or
mixed with a weight total. Existing `documentWeight`/`difference`/`acquisitionAmount`
semantics are unchanged.

## Tests

- Contracts `batches.test.ts` (+2): unit default/accepted `KG`, `PCS`, decimal KG,
  integer PCS, fractional PCS rejected, required location (friendly message),
  non-positive quantity, unknown fields.
- API `batches.e2e.test.ts` (+4, updated): PCS whole quantities + totals; one unit
  per batch (`UNIT_MISMATCH`); required location (missing/foreign-warehouse
  rejected); `resourceCategoryName` + `suggestedLocationId` + bag location on
  detail; `PCS` batch reconciliation rejected (`BATCH_NOT_WEIGHT`); barcode
  uniqueness and derived totals updated to `quantity`/`totalQuantity`.
- Web: `shared/lib/ean13.test.ts` (new); `entities/batch` (+4: `formatQuantity`,
  `handlingUnitLabel`); `batch-form` (handling-unit form + `initialBagDraft`);
  `receiving` (context/label data + field separation).

## Verification

- `pnpm verify` green: contracts **66**, web **169**, API **173**; lint, Prisma
  validate, typecheck, Next + Nest builds.
- Migration applied to the isolated `aitvaras_test` DB and the dev DB; existing
  records preserved.
- `git diff --check` clean; `/sandelys` untouched; no commit/push.

## Limitations

- Reconciliation for `PCS` batches is not implemented (weight-only).
- The internal model is still named `Bag` (now a general handling unit); renaming
  to `HandlingUnit` is a deferred mechanical refactor.
- Browser print relies on `window.print()` (no hardware integration); timing is a
  short delay after the label renders.

## Files changed

Prisma `schema.prisma` + migration `20260929140000_handling_unit_quantity`;
contracts `batches.ts` (+test); API `modules/batches/{batch.mapper,batches.service}.ts`,
`test/batches.e2e.test.ts`; web `shared/lib/ean13.ts` (+test),
`shared/ui/ean13-barcode.tsx` (+index), `entities/batch/batch.ts` (+test),
`features/manage-batches/lib/{batch-form,receiving}.ts` (+tests),
`features/manage-batches/ui/{bag-label,receiving-page,batch-details-page,batches-page}.tsx`;
docs `batches.md`, `domain-glossary.md`, `scope.md`, `TODO.md`, `AGENTS.md`; this
record.
