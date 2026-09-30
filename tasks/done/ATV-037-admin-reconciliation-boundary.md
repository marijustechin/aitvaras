# ATV-037 — ADMIN reconciliation boundary cleanup

- **Status:** done (uncommitted; for human review)
- **Scope:** narrow UI/domain-boundary follow-up to ATV-030
- **Depends on:** ATV-030 (reconciliation), ATV-031 (worker UI), ATV-032 (units), ATV-034 (units list)

## Objective

Remove technical `GoodsReceiptLine` mechanics and warehouse-worker bag-creation
controls from the ADMIN reconciliation screen, replacing them with a formal,
business-oriented UI — without changing the underlying reconciliation model.

## 1. Technical receipt-line selection removed from the UI

The ADMIN page no longer renders `Pajamavimo eilutė` or any `GoodsReceiptLine`
selector (and no "no compatible lines" guidance). The reconciliation form now
contains only formal/business data:

- `Dokumentinis svoris`
- `Įsigijimo vertė`
- `Dokumento data`
- `Dokumento Nr.`

plus the `Faktiškai susverta` / `Dokumentuose` / `Skirtumas` summary and the
`Patvirtinti pajamavimą` action. `DraftReconciliation`, `reconciliationFormError`
and `toReconcilePayload` dropped `receiptLineId`; the `ReconcileBatchRequest`
contract no longer accepts it (`.strict()` rejects it if sent).

## 2. Internal receipt/line resolution (changed)

The relational model is preserved: `GoodsReceipt → GoodsReceiptLine → Batch`.
The client no longer picks the line; `BatchesService.resolveReceiptLine` resolves
or creates it deterministically from the batch context + formal data:

1. **retry** — reuse the line the batch is already linked to (no duplicate);
2. **reuse** — an existing compatible, **unlinked** receipt line (same supplier
   via the receipt partner, resource and warehouse; latest id first);
3. **create** — a `GoodsReceipt` (partner = batch supplier, document
   date/number) with one line (`KG`, quantity = documentary weight, unit price =
   value ÷ weight).

A reused line is never mutated; the accepted documentary values
(`documentWeight`/`acquisitionAmount`) live on the batch. This makes retries
idempotent (verified: retry reuses the same receipt/line id, line count
unchanged). Removed now-unreachable errors `RECEIPT_LINE_NOT_FOUND`,
`RECEIPT_INCOMPATIBLE`, `RECEIPT_LINE_ALREADY_RECONCILED`; added
`RECEIPT_CREATE_FAILED` for an unexpected internal failure.

## 3. Add-bag controls removed from ADMIN

The `Pridėti maišą` form (location/unit/quantity) and all warehouse-worker
bag-registration controls were removed from the ADMIN batch-detail page. Bag
registration stays exclusively in the `Registruoti sandėlyje` worker flow.

## 4. Bag list (read-only)

The ADMIN page keeps a read-only `Partijos maišai` list: `Barkodas`, `Vieta`,
`Kiekis`, `Mato vnt.`, `Užregistruota`, with an optional `Etiketė` label
preview/reprint (reuses the existing label; creates nothing). No create/edit
controls.

## Role separation

- `WAREHOUSE_WORKER`: `Registruoti sandėlyje`, batch creation/selection, bag
  registration, label printing (unchanged).
- `ADMIN`: `Pajamavimas`, batch review, read-only unit list, formal
  reconciliation/confirmation.

## Files changed

- `packages/contracts/src/batches.ts` (+test) — `ReconcileBatchRequest` drops
  `receiptLineId`;
- `apps/api/src/modules/batches/batches.service.ts` — internal
  `resolveReceiptLine` replaces the user-supplied line + compatibility checks;
- `apps/api/test/batches.e2e.test.ts` — reconciliation tests rewritten for
  internal resolution, reuse, retry idempotency;
- web `features/manage-batches/lib/batch-form.ts` (+test) and
  `features/manage-batches/ui/batch-details-page.tsx` — formal-only reconciliation
  form, no add-bag controls, read-only unit list;
- docs `batches.md`, `TODO.md`; this record.

## Tests

- Contracts: `ReconcileBatchRequestSchema` no longer accepts a receipt-line id.
- API e2e (updated): exact-match creates the internal line (asserts its
  resource/warehouse/unit/quantity/receipt/link); compatible unlinked line is
  reused; incompatible existing line is ignored and a new one created; discrepancy
  correction retries reuse the same receipt/line with no duplicate; no new bags;
  empty/PCS/unknown/non-admin/invalid-payload rejections (including a sent
  `receiptLineId` being rejected).
- Web: reconciliation draft/validation/payload exclude the technical selector.
- No brittle CSS tests.

## Verification

- `pnpm verify` green: contracts **66**, web **184**, API **173**; lint, Prisma
  validate, typecheck, Next + Nest builds.
- `git diff --check` clean.
- `/sandelys` untouched; no commit/push.

## Limitations

- A reused line is not mutated on retry, so a line created by the first reconcile
  keeps its original quantity if the documentary value is later corrected; the
  batch holds the accepted values. (Documented; changing this would require a
  created/reused flag.)
- The internal `GoodsReceiptLine` still exists (correct relational model); it is
  simply no longer a user-facing selector.
