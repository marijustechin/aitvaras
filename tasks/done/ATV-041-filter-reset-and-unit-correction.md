# ATV-041 — Filter reset and physical unit correction/void

- **Status:** done (uncommitted; for human review)
- **Scope:** narrow ADMIN `Gavimai` filter UX + warehouse-worker physical correction
- **Depends on:** ATV-030 (reconciliation), ATV-032 (units), ATV-038 (`Gavimai` queue)

## Objective

Two closely related gaps in the receiving slice:

1. the `Gavimai` filter panel had no way to clear filters back to the default view;
2. a `DISCREPANCY` batch could only be resolved by correcting the **documentary**
   weight — there was no way to fix the **physical** units that caused the
   mismatch.

Physical reality is authoritative, so the worker (not only `ADMIN`) must be able to
correct a unit's quantity/location or void it, audited and without hard-deleting.

## 1. Filter reset (`Gavimai`)

`features/manage-batches/lib/batch-list.ts` gains `RESET_FILTERS_LABEL`
(`Atstatyti filtrus`) and `hasActiveBatchFilters(filters)` (compares each field with
`createBatchListFilters()`). The `gavimai-page.tsx` filter panel renders an
`Atstatyti filtrus` button that resets to the default `Reikia patvirtinti` view,
disabled when no filter is active.

## 2. Physical unit correction/void (worker)

### Data model

- `Bag.status BagStatus { ACTIVE, VOIDED }` (default `ACTIVE`), plus
  `voidedById?`, `voidedAt?`, `voidReason? varchar(500)`. A unit is **never
  deleted**; voiding preserves barcode and history.
- New append-only `BagCorrection` (`QUANTITY` | `LOCATION` | `VOID`): `bagId`,
  `previousValue?`/`newValue? varchar(255)`, `reason? varchar(500)`,
  `createdById`, `createdAt`. Migration `handling_unit_corrections`.
- The generated migration also normalised the ATV-030 receipt-line FK to
  `SET NULL`; that unintended drift was **reverted** — `Batch.receiptLine` is now
  explicitly `onDelete: Restrict`, matching ATV-030, and the receipt-line FK
  clauses were removed from this migration.

### API (`apps/api/src/modules/batches/`)

- `PATCH /batches/:id/bags/:bagId` (`ADMIN` or `WAREHOUSE_WORKER`): correct
  `quantity` and/or `warehouseLocationId` on an **active** unit. `UpdateBagRequest`
  is strict and requires at least one field; only changed fields are written and
  each records one `BagCorrection`. A no-op changes nothing and records no trail.
  `PCS` quantities must be whole units (`UNIT_MISMATCH`); a new location must be
  active and belong to the batch warehouse.
- `POST /batches/:id/bags/:bagId/void` (`ADMIN` or `WAREHOUSE_WORKER`): mark the
  unit `VOIDED` with who/when and an optional reason (`VoidBagRequest`), append a
  `VOID` correction. The unit is preserved and excluded from totals.
- Guards: `BAG_NOT_FOUND` (404), `BATCH_CONFIRMED` (409) for a frozen batch,
  `BAG_VOIDED` (400) when correcting a voided unit.
- Totals and reconciliation now count **active** units only: `list`/`get`
  `bagCount`/`totalQuantity` and `reconcile`'s measured weight filter on
  `status: ACTIVE`. `createBag` now allows `PENDING` **and** `DISCREPANCY`
  (rejects `CONFIRMED`, `BATCH_CONFIRMED`).
- `BatchDetail.corrections` is returned newest-first via `toBagCorrection`.

### Contracts (`@aitvaras/contracts`)

`BAG_STATUSES`/`BagStatusSchema`/`BAG_STATUS_LABELS`, `Bag.status` + void fields,
`BagCorrectionSchema` + `BAG_CORRECTION_KINDS`, `BatchDetail.corrections`,
`UpdateBagRequestSchema`, `VoidBagRequestSchema`.

### Web

- `entities/batch`: `isBatchOpen` now `PENDING || DISCREPANCY`;
  `bagStatusLabel`/`bagStatusClass`, `correctionKindLabel`,
  `EMPTY_CORRECTIONS_MESSAGE`.
- `lib/batch-form.ts`: `DraftCorrection`, `correctionDraftFromBag`,
  `correctionChanged`, `correctionFormError`, `toUpdateBagPayload`,
  `toVoidBagPayload`.
- `lib/receiving.ts`: `openReceivingBatches` includes `DISCREPANCY`; correction
  labels/heading (`Reikia patikslinti`) and `activeBatchUnits`/`voidedBatchUnits`.
- `receiving-page.tsx`: batches fetched from `/batches` and split into
  `Nepatvirtintos partijos` (`PENDING`) and `Reikia patikslinti` (`DISCREPANCY`);
  per-unit `Taisyti`/`Anuliuoti`/`Spausdinti` actions with inline correction and
  void panels; a muted `Anuliuoti maišai` list; lists refresh after each change.
- `batch-details-page.tsx` (ADMIN, read-only): unit `Būsena` column (voided rows
  muted, reason shown) and a `Pataisymų istorija` table.
- `batch-list.ts`/`gavimai-page.tsx`: filter reset (above).

## Decisions

- Physical correction does **not** change the batch status: a `DISCREPANCY` stays
  discrepant until an `ADMIN` re-reconciles (with the corrected totals and/or the
  documentary weight). This keeps one authority for the confirmed state.
- Correct/void is allowed only while the batch is `PENDING`/`DISCREPANCY`; a
  `CONFIRMED` batch is frozen. Post-confirmation corrections are out of scope.
- Voiding (audited) is used instead of deletion; the trail is a small, focused
  `BagCorrection` model — not a generic audit framework.
- Only changed fields produce a correction row; a no-op records nothing.

## Files changed

- DB: `packages/database/prisma/schema.prisma`; migration
  `20260929131517_handling_unit_corrections`.
- Contracts: `packages/contracts/src/batches.ts` (+`batches.test.ts`).
- API: `apps/api/src/modules/batches/{batch.mapper.ts,batches.service.ts,batches.controller.ts}`
  (+`test/batches.e2e.test.ts`).
- Web: `entities/batch/batch.ts` (+test);
  `features/manage-batches/lib/{batch-form.ts,batch-form.test.ts,batch-list.ts,batch-list.test.ts,receiving.ts,receiving.test.ts}`;
  `features/manage-batches/ui/{gavimai-page.tsx,receiving-page.tsx,batch-details-page.tsx}`.
- Docs: `batches.md`, `scope.md`, `domain-glossary.md`, `authorization.md`,
  `AGENTS.md`, `TODO.md`; this record.

No authorization weakening: correction/void reuse the existing role guard and add
no new roles.

## Tests

- Contracts (batches, 27 total): bag status/labels, voided unit parse,
  `UpdateBagRequestSchema` (at least one field, non-positive, unknown field),
  `VoidBagRequestSchema` (reason length, unknown field), `BagCorrectionSchema`.
- API e2e (batches, 34): quantity/location correction with trail; no-op records
  nothing; void removes a unit from totals but preserves it and is excluded from
  reconciliation; correcting/voiding a voided unit or a confirmed batch is
  rejected; payload validation (incl. fractional PCS, cross-warehouse location);
  route roles + ids; adding to a `DISCREPANCY` batch works.
- Web: `entities/batch` (unit status/labels/colours, correction kind labels),
  `batch-form` (correction draft/validate/payload/void payload),
  `receiving` (open batches incl. `DISCREPANCY`, active/voided split, labels),
  `batch-list` (reset detection + source check for the reset control,
  correction history source check).

## Verification

- `pnpm verify` green: contracts **75**, web **204**, API **180**; lint, Prisma
  validate, typecheck, Next + Nest builds.
- `git diff --check` clean.
- `/sandelys` untouched; no commit/push.

## Limitations / out of scope

- Bag split/merge and EAN lineage to child units; post-confirmation corrections.
- `PCS` batches are still not weight-reconciled (unchanged from ATV-030).
- Correction locations are recorded by **name** in the trail (readable, may lag a
  later location rename); the unit itself stores the id.
