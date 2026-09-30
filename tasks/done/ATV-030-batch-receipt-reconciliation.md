# ATV-030 — Batch ↔ GoodsReceipt reconciliation (formal confirmation)

- **Status:** done (uncommitted; for human review)
- **Scope:** second receiving slice, follows ATV-029 (batches/bags) and ATV-020
  (GoodsReceipt)
- **Depends on:** ATV-029 batches/bags, ATV-020/021 receipts & placement

## Objective

Formally reconcile an existing physically received `PENDING` batch with an
Aitvaras `GoodsReceipt`: record the documentary weight and the batch's initial
acquisition value, compare them with the measured bag total, and set
`CONFIRMED` (exact) or `DISCREPANCY` — **without** creating a second inventory
quantity. Explicitly not: production movements, transformations, output lots,
order allocation or cost redistribution.

## Chosen model

### Batch ↔ GoodsReceipt relationship

`GoodsReceipt → GoodsReceiptLine → Batch → Bags`.

- A GoodsReceipt has one supplier (partner) and 1..n lines; a line carries the
  resource and warehouse. A batch is exactly one resource/supplier/warehouse, so
  the **line** (not the header) is the correct anchor.
- New `Batch.receiptLineId` (nullable, **unique**) FK → `GoodsReceiptLine`
  (`ON DELETE RESTRICT`). One batch → at most one line; one line → at most one
  batch; a receipt may still reconcile **many** batches via many lines (no forced
  1:1 at header level).
- A `PENDING` batch may exist without any receipt; a reconciled batch always
  points to exactly one line. The unique constraint + the terminal `CONFIRMED`
  state prevent double reconciliation.

### Physical vs documentary quantity

- **Measured** weight is always `SUM(bags.weight)`, derived server-side on every
  read and on reconcile; never stored and never accepted from the client.
- **Documentary** weight is `Batch.documentWeight` (`Decimal(14,3)`), entered at
  reconciliation and **never** written over the measured value.
- `difference = documentWeight − measuredWeight` is derived (`Decimal`, same
  precision, signed) and serialised as a string. No tolerance is applied —
  exact equality is the only clean-confirmation rule.
- The linked receipt line is the **formal document anchor** (supplier, document
  reference); the batch holds the accepted reconciliation values. The two
  quantities are never merged.

### Acquisition value

- `Batch.acquisitionAmount` (`Decimal(14,2)`, EUR) is the batch's **initial
  acquisition value**, entered by the ADMIN at reconciliation. Money follows the
  existing convention (EUR only, decimals exchanged as strings; no currency
  model, no VAT/accounting engine).
- Unit cost is **not** stored: it is derivable from the agreed quantity basis
  (acquisition value ÷ documentary weight). No cost-allocation logic is invented.
- `GoodsReceipt` gains optional `documentDate`/`documentNumber` (formal document
  metadata, distinct from `createdAt`); reconciliation may populate them when not
  already set and never overwrites an existing value.

### Status transitions

- `PENDING` → `CONFIRMED` when `documentWeight == measuredWeight` (sets
  `confirmedAt`).
- `PENDING` → `DISCREPANCY` when they differ (`confirmedAt` stays null).
- `DISCREPANCY` → `CONFIRMED` on a corrected documentary value (re-reconcile with
  the same line). No irreversible trap.
- `CONFIRMED` is **terminal**: a second reconcile is rejected
  (`BATCH_ALREADY_CONFIRMED`, `409`).

### Dates (kept distinct)

- `arrivalDate` — physical shipment arrival (batch), unchanged by reconciliation;
- bag `createdAt` — registration/label time;
- `GoodsReceipt.documentDate` — formal business-document date;
- `Batch.confirmedAt` — when reconciliation succeeded.

## Double-count prevention

The bags are the **physical quantity source**; the GoodsReceipt is the
documentary/financial record. Reconciliation links an existing/linked line and
records values — it creates **no** bags, receipt lines or stock, and there are no
stock tables anywhere. Verified by an API test that the bag count is unchanged
before/after reconcile and after a rejected re-confirm.

## API

- New `POST /batches/:id/reconcile` (ADMIN; `200`), body
  `{ receiptLineId, documentWeight, acquisitionAmount, documentDate?, documentNumber? }`
  (strict). The measured total is **not** in the payload.
- Validation: batch exists; not `CONFIRMED`; has ≥1 bag; line exists; line not
  already linked to another batch; line supplier (via receipt partner), resource
  and warehouse match the batch; `documentWeight > 0`; `acquisitionAmount ≥ 0`.
- Explicit error codes in the body: `BATCH_NOT_FOUND`/`RECEIPT_LINE_NOT_FOUND`
  (404), `BATCH_EMPTY`/`RECEIPT_INCOMPATIBLE` (400),
  `BATCH_ALREADY_CONFIRMED`/`RECEIPT_LINE_ALREADY_RECONCILED` (409); schema
  failures return the pipe's `VALIDATION_ERROR`.
- Returns a `BatchReconciliation` summary (batch id/code/status, bag count,
  measured/document weight, difference, acquisition value, receipt/line ids,
  document date/number, confirmedAt).
- `Batch` contract now carries the reconciliation fields (nullable) so list/detail
  expose the state.

## Web (FSD-lite)

Batch detail page gains a reconciliation section:

- For a `CONFIRMED` batch: read-only summary (measured, documentary, difference,
  acquisition value, document reference, confirmation date).
- For an `ADMIN` on a non-confirmed, non-empty batch: a "Patvirtinti pajamavimą"
  form — pick a compatible receipt line (filtered by supplier/resource/warehouse),
  enter documentary weight and acquisition value (prefilled from the selected
  line's quantity/total), optional document date/number, with live
  `Faktiškai susverta` / `Dokumentuose` / `Skirtumas` (difference flagged as
  `neatitikimas` when non-zero, subtle destructive colour).
- The request payload never includes the measured total.

## Tests

- Contracts `batches.test.ts` (+12): reconcile request (line/weight/amount/date/
  number, unknown fields), reconciliation summary.
- API `batches.e2e.test.ts` (+11): exact-match → `CONFIRMED`; measured derived;
  multi-weight sum; mismatch → `DISCREPANCY` + signed difference; discrepancy
  correction → `CONFIRMED`; empty batch; already-confirmed (409); incompatible
  supplier/resource/warehouse; unknown batch/line (404); non-admin (403);
  no new bags / no duplication; acquisition + document metadata persisted;
  receipt line already reconciled (409); arrival/confirmation dates distinct.
- Web `entities/batch` (+4) and `features/manage-batches/lib` (+4): difference
  formatting/sign, exact-match check, confirmed state, form validation, payload
  excludes measured total.

## Verification

- `pnpm verify` green: contracts **64**, web **138**, API **169** (was 64 / 134 /
  158); lint, Prisma validate, typecheck and Next + Nest builds.
- Migration `batch_reconciliation` applied to the isolated `aitvaras_test` DB and
  the dev DB (additive; new columns + unique index + FK).
- `git diff --check` clean; `/sandelys` untouched; no commit/push.

## Files changed

Prisma `schema.prisma` + migration `20260929120000_batch_reconciliation`;
`packages/contracts` (`batches.ts` + test, `receipts.ts`); API
(`modules/batches/{batches.service,batch.mapper,batches.controller}.ts`,
`modules/receipts/receipt.mapper.ts`, `test/batches.e2e.test.ts`); web
(`entities/batch/{batch,batch.test}.ts`,
`features/manage-batches/lib/{batch-form,batch-form.test}.ts`,
`features/manage-batches/ui/batch-details-page.tsx`); docs (`batches.md`,
`receipts.md`, `domain-glossary.md`, `architecture.md`, `authorization.md`,
`scope.md`, `TODO.md`, `AGENTS.md`, `README.md`); this record.

## Limitations / unresolved

- **Bag correction is not possible**, so a `DISCREPANCY` can only be resolved by
  correcting the documentary value (not by editing bags). Adding bags after a
  `DISCREPANCY` is not allowed (bags are `PENDING`-only).
- Documentary and receipt-line quantities are stored separately (batch
  reconciliation value vs the formal line); the UI prefills one from the other,
  but they are not forced equal.
- The acquisition value is not split/redistributed; unit cost is derived, not
  stored. No VAT/accounting treatment.
- The manual receipt form does not yet edit `documentDate`/`documentNumber`.
- Barcode labels still print the value as text (no scannable graphic).

## Recommended next

Decide whether bag correction or a tolerance rule is a real, confirmed need
before extending; otherwise move to the next confirmed receiving/inventory slice
(scan-driven movement) only with a scoped task.
