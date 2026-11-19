# ATV-070 — Receipt list, per-receipt manager confirmation and revisable expense allocation

Status: **READY_FOR_HUMAN_REVIEW** (uncommitted, together with ATV-066…069).

## Objective

Move the receiving workflow to receipt-first navigation: `/receipts` lists
receipts by G…, the manager confirms batches by P… on one receipt screen, and
transport/customs costs are previewed/applied once per receipt, including late
invoices and revisions on already-confirmed batches.

## Implemented

### `/receipts` is a receipt list (`Priėmimai`)

- Heading renamed to `Priėmimai`; one row per receipt even with several batches.
- Columns: `Priėmimas`, `Priėmimo data`, `Tiekėjas`, `Patvirtintos partijos`,
  `Būsena`, `Veiksmai`.
- `Patvirtintos partijos` = `—` for zero batches, otherwise `confirmed iš total`.
  Statuses: `Be partijų`, `Laukia patvirtinimo`, `Patvirtintas`.
- Filters:
  - `Reikia patvirtinti` / `Laukiama patvirtinimo` → receipts with at least one
    pending batch;
  - `Patvirtinta` → receipts whose batches are all confirmed;
  - `Visos` → all receipts, including zero-batch receipts.
  - Supplier/date apply at receipt level; resource/warehouse/batch-code filters
    match a receipt once when any batch matches all supplied batch-specific
    filters; zero-batch receipts cannot match them.
  - Grouping happens first, then newest-first sorting and client-side pagination
    (`20` receipts per page). `Atstatyti filtrus` returns to `Reikia patvirtinti`.
- The G… code opens the receipt: zero-batch receipts open
  `/receiving/[deliveryId]`; other receipts open `/receipts/[deliveryId]`.
  `Tvirtinti` / `Peržiūrėti` open the same manager screen.
- Batch-less deletion from ATV-069 is retained.

### Manager receipt screen (`/receipts/[deliveryId]`, ADMIN)

- `Priėmimas G…` heading and supplier/arrival shown once.
- One row per batch with the required columns and labels:
  `Partija`, `Prekė`, `Priimta`, `Dokumentuose`, `Skirtumas`,
  `Įsigijimo vertė, €`, `Būsena / veiksmas`.
- `Priimta` is read-only from active packages (`netWeight` kg for WEIGHT) or
  active item lines (`vnt.` for PIECE), including zero.
- `Dokumentuose` takes the matching unit; an empty value shows `—` for the
  difference.
- Document date/number and the discrepancy acknowledgement are available in the
  expanded row/dialog.
- Multi-product PIECE shows `N prekės`; expansion reveals product names and the
  itemised comparison. `Pagal prekes` and `Bendras kiekis` are both preserved;
  itemised confirmation records per-product discrepancies separately.
- **`Patvirtinti partiją`** confirms only that row; siblings can stay pending.
  The list derives `Patvirtintas` once the last batch is confirmed. No separate
  receipt-confirmation button exists.
- The `Priėmimo išlaidos` block is below the batch table and manager-only.

### Warehouse-worker separation

- Removed the expense block and all acquisition/transport/customs controls from
  the worker receipt/editor screens.
- Workers keep batches, packages, products, tare, gross/net weight, piece
  quantities, locations, corrections and labels, plus direct links and pending
  continuation.
- API financial endpoints are ADMIN-only:
  `GET/PUT /deliveries/:id/expenses`, `POST .../expenses/preview`,
  `POST .../expenses/apply`.
- Batch list/detail responses redact documentary/acquisition fields
  (`documentWeight`, `documentPieces`, `difference`, `acquisitionAmount`,
  document date/number) for non-ADMIN callers; the operational batch shape
  remains available to workers.

### Expense preview, application and late invoices

- The manager block keeps `Transportas, €`, `Muitinė, €` and
  `Išlaidų paskirstymo būdas`, and shows the proposed transport/customs share per
  batch before applying.
- `POST /deliveries/:id/expenses/preview` computes the proposal without writing.
- `POST /deliveries/:id/expenses/apply` applies the whole receipt:
  - computes each amount separately to the cent with the existing methods
    (`Pagal vertę`: actual net kg for all-WEIGHT or actual pieces for all-PIECE;
    `Po lygiai`: equal across positive quantities; mixed receipts only EQUAL);
  - writes one `DeliveryExpenseApplication` (`appliedById`, `appliedAt`,
    amounts/method) and one entry per batch with the previous/new transport and
    customs shares;
  - updates the current `Batch.allocatedTransportAmount` /
    `allocatedCustomsAmount` for all batches.
- A confirmed batch receives only the valuation difference; physical quantity,
  confirmation history, barcodes and discrepancies are untouched.
- A pending batch contributes its current share when it is confirmed.
- Reapplying identical amounts/method writes **no** application and has no
  valuation effect.
- The preview shows allocated totals and any unallocated balance.

## Files changed

### Database / contracts

- `packages/database/prisma/schema.prisma`
- `packages/database/prisma/migrations/20261118180000_expense_application_ledger/`
- `packages/contracts/src/incoming-deliveries.ts`
- `packages/contracts/src/delivery-expenses.ts`
- `packages/contracts/src/incoming-deliveries.test.ts`

### API

- `apps/api/src/modules/batches/batches.service.ts`
- `apps/api/src/modules/batches/batches.controller.ts`
- `apps/api/src/modules/batches/deliveries.controller.ts`
- `apps/api/src/modules/batches/batch.mapper.ts`
- `apps/api/src/modules/batches/batch-redaction.ts` (new)
- `apps/api/src/modules/batches/expense-allocation.ts`
- `apps/api/test/batches.e2e.test.ts`
- `apps/api/test/delivery-expenses.e2e.test.ts`

### Web

- `apps/web/src/app/receipts/[deliveryId]/page.tsx` (new)
- `apps/web/src/app/receipts/batches/[id]/page.tsx`
- `apps/web/src/features/manage-batches/ui/receipt-manager-page.tsx` (new)
- `apps/web/src/features/manage-batches/ui/gavimai-page.tsx`
- `apps/web/src/features/manage-batches/ui/delivery-expenses.tsx`
- `apps/web/src/features/manage-batches/ui/receiving-delivery.tsx`
- `apps/web/src/features/manage-batches/lib/batch-list.ts`
- `apps/web/src/features/manage-batches/lib/batch-list.test.ts`
- `apps/web/src/features/manage-batches/lib/receiving.ts`
- `apps/web/src/features/manage-batches/index.ts`

### Docs / task

- `AGENTS.md`
- `docs/authorization.md`
- `docs/batches.md`
- `docs/domain-glossary.md`
- `docs/frontend-architecture.md`
- `docs/receipts.md`
- `docs/scope.md`
- `docs/stock-summary.md`
- `TODO.md`
- `docs/screenshots/atv-070/`
- this record

## Decisions

- **Receipt-first list.** One row per receipt; confirmation counts always cover
  the whole receipt. Batch-specific filters only narrow which receipts appear.
- **Per-batch confirmation on the receipt screen.** The manager confirms P01/P02
  independently; receipt status is derived, never a separate action.
- **Explicit allocation apply.** Expenses are not auto-frozen at confirmation.
  The manager previews and applies a receipt allocation; the ledger records the
  previous/new share per batch.
- **Late invoices change valuation only.** A confirmed batch may receive a
  valuation difference through a new application; its physical/confirmation data
  is immutable.
- **No-op applies.** Identical amounts/method and shares write nothing.
- **Worker financial separation.** Financial documents and actions are ADMIN-only
  in both API and UI; worker responses redact documentary/financial fields.

## Verification

- `npm run verify` passed: lint, `db:validate`, typecheck, tests and builds.
  - API: 27 files / **267** tests.
  - Web: 31 files / **292** tests.
  - Contracts: 15 files / **104** tests.
- API integration coverage:
  - preview and apply proportional WEIGHT shares; stock delta after each
    confirmation;
  - late invoice after P01 confirmation: preview/saved 50/50, P01 stock +50, no
    quantity change; confirming P02 recognises the remaining 50;
  - revision 100 → 120: each batch +10, final allocated 120, zero unallocated;
  - identical reapply: `applied=false`, no new application/valuation;
  - mixed receipt rejects `BY_VALUE`, accepts `EQUAL`;
  - cent rounding;
  - financial endpoints 403 for worker/accounting roles;
  - worker batch read is redacted; admin read retains values.
- Browser verification (isolated fixtures, `localdev` ADMIN):
  - receipt list default/`Visos`/mobile; one row per receipt with counts/status;
  - manager late-invoice preview showed 50 € per 10 kg batch and 0 unallocated;
  - applying 100 € then confirming P02, revising to 120 € produced 60 € each and
    120 € allocated;
  - itemised PIECE entry showed per-product `−1/+1 vnt.` and the discrepancy
    dialog listed both products;
  - mixed receipt preview showed `Po lygiai` 5 € + 2.50 € per batch;
  - worker receipt screen contained no `Transportas`, `Muitinė` or
    `Įsigijimo` controls;
  - manager/worker screens checked on desktop and mobile.
- Screenshots in `docs/screenshots/atv-070/`:
  `receipts-list-desktop.png`, `receipts-list-all-desktop.png`,
  `receipts-list-mobile.png`, `manager-late-invoice-preview-desktop.png`,
  `manager-allocated-receipt-desktop.png`, `manager-mixed-preview-desktop.png`,
  `manager-piece-itemised-desktop.png`,
  `manager-piece-discrepancy-dialog-desktop.png`,
  `manager-piece-confirmed-desktop.png`, `manager-receipt-mobile.png`,
  `worker-receipt-desktop.png`, `worker-receipt-mobile.png`.

## Live data / migration

- Migration adds the application ledger tables only; existing batch allocation
  columns, expense headers and historical valuations are preserved. No application
  history is invented for pre-existing allocations.
- The implementation performs no live-data backfill. Isolated fixtures
  (`G2611-06`…`G2611-10` during the verification run) were removed.
- Live records observed during the task were left untouched by the implementation
  and fixture cleanup. The operator continued using the live application after
  that cleanup (including further confirmations, expense applications and new
  receipts); those later changes are outside this task and were not modified by
  it.

## Unresolved / deliberately out of scope

- Existing pre-ledger allocations have no historical application rows; a future
  backfill/audit task would be needed if that history is required.
- Reversing/deleting an application is not implemented; corrections are new
  audited applications.
- Receipt list pagination is client-side (after grouping); no server pagination.
- The dashboard stock value remains readable by authenticated users; only
  documentary/acquisition fields and expense actions are redacted/ADMIN-gated.

## Recommended next task

Human review and commit of ATV-066…070. Any audit/backfill, reversal workflow,
server-side pagination or broader financial visibility change needs a new
confirmed task.
