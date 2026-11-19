# ATV-069 — Batch-less receipt rows and protected receipt deletion

Status: **READY_FOR_HUMAN_REVIEW** (uncommitted, together with ATV-066…068).

## Objective

1. Remove the separate `Pradėti priėmimai be partijų` block and merge receipts
   without batches into the existing `Gautos partijos` table under the correct
   status/filter rules.
2. Allow deleting an eligible batch-less receipt from that row, with a
   code-specific confirmation, protected API eligibility and a non-zero-expense
   block.
3. Verify the flows with isolated fixtures while preserving the live
   `G2611-01`, `G2611-02` and `G2611-03` records.

## Implemented

### One combined `Gautos partijos` table

- The separate batch-less block was removed.
- `combinedReceiptRows` merges:
  - normal `Batch` rows from the existing `/batches` query;
  - one row per `IncomingDelivery` with `batchCount === 0`.
- Row inclusion follows the requested table exactly:
  - `Reikia patvirtinti` (default) → `PENDING` batches only;
  - `Visos` → all matching batch rows **plus** batch-less receipts;
  - `Laukiama patvirtinimo` / `Patvirtinta` → only batches of that status.
- A batch-less row shows:
  - receipt code, arrival date and supplier;
  - `—` in `Partija`, `Tipas / turinys`, `Sandėlis` and `Kiekis`;
  - status `Be partijų`;
  - the receipt code links to `/receiving/[deliveryId]` (the existing receipt
    editor) so the first batch can be added.
- When the first batch exists, the normal batch row replaces the empty-receipt
  row on the next list load.
- Supplier and arrival-date filters apply to both row types. A resource,
  warehouse or batch-code filter excludes batch-less receipts.
- The combined rows are sorted newest-first by their own `createdAt`; no
  pagination exists, and a future pagination layer must run after the merge.
- `Atstatyti filtrus` returns to `Reikia patvirtinti`; batch-less rows disappear.

### Deletion

- Eligible batch-less rows show **`Ištrinti priėmimą`**.
- The confirmation dialog uses the actual code:
  `Ištrinti priėmimą G2611-02?`, with `Atšaukti` / `Ištrinti`.
- Successful deletion shows a global toast (`Priėmimas G… ištrintas.`), reloads
  the table and keeps the selected filters.
- A batch-less receipt with a non-zero transport/customs amount does not offer the
  action; the row explains
  `Negalima ištrinti: užregistruota transporto arba muitinės išlaidų.`
- `IncomingDelivery` now exposes `hasNonZeroExpenses` so the list can make that
  decision without extra per-row requests.

### API eligibility and atomicity

`DELETE /deliveries/:id` (`ADMIN` or `WAREHOUSE_WORKER`):

- Locks the delivery row with `SELECT … FOR UPDATE` in one transaction.
- Counts the child batches and inspects the expense record inside the same locked
  transaction.
- Rejects any receipt with a batch: `409 DELIVERY_HAS_BATCHES`.
- Rejects a non-zero transport/customs amount: `409 DELIVERY_HAS_EXPENSES`.
- Allows deletion when the expense record exists but both amounts are zero; the
  record is removed by the cascade.
- The row lock protects against a first batch inserted concurrently between the
  count and the delete (a child insert needs a key-share lock on the parent).
- No audit/delete history is added; deletion is intentionally only for
  batch-less, expense-free receipts.

## Files changed

### API / contracts

- `packages/contracts/src/incoming-deliveries.ts` — `hasNonZeroExpenses`.
- `packages/contracts/src/incoming-deliveries.test.ts`
- `apps/api/src/modules/batches/batch.mapper.ts` — expose the expense flag.
- `apps/api/src/modules/batches/batches.service.ts` — `deleteDelivery`.
- `apps/api/src/modules/batches/deliveries.controller.ts` — DELETE route.
- `apps/api/test/batches.e2e.test.ts` — deletion/rejection coverage.

### Web

- `apps/web/src/features/manage-batches/lib/batch-list.ts` — combined rows,
  empty-receipt filtering, supplier options, labels.
- `apps/web/src/features/manage-batches/lib/batch-list.test.ts`
- `apps/web/src/features/manage-batches/ui/gavimai-page.tsx` — merged table,
  delete dialog/toast, blocked-expense explanation.
- `apps/web/src/features/manage-batches/lib/receiving.ts` — removed the old
  empty-receipt section helper/labels.
- `apps/web/src/features/manage-batches/lib/receiving.test.ts`

### Docs / task

- `docs/authorization.md`
- `docs/batches.md`
- `docs/frontend-architecture.md`
- `TODO.md`
- `docs/screenshots/atv-069/`
- this record

## Decisions

- **Empty receipts live in the main table, only in `Visos`.** This keeps the
  default confirmation queue focused on batches and makes started-but-empty work
  deliberately discoverable without a separate block.
- **No stored delivery status.** `batchCount === 0` is the only emptiness signal;
  the first batch naturally replaces the empty row.
- **Atomic row lock, not a check-then-delete.** The lock is the concurrency
  protection for a first batch added by another operator.
- **Non-zero expenses block deletion; a zero record does not.** The UI explains
  the block; the API is authoritative.
- **Deletion is a receiving-role action.** It follows `ADMIN` /
  `WAREHOUSE_WORKER`; other authenticated users can still read the list but see no
  delete action.

## Verification

- `npm run verify` passed: lint, `db:validate`, typecheck, tests and builds.
  - API: 27 files / **268** tests.
  - Web: 31 files / **291** tests.
  - Contracts: 15 files / **104** tests.
- API integration coverage (`aitvaras_test`):
  - batch-less receipt → DELETE `204`, gone from `GET /deliveries`;
  - receipt with a batch → `409 DELIVERY_HAS_BATCHES`, still present;
  - non-zero expense → `409 DELIVERY_HAS_EXPENSES`, `hasNonZeroExpenses = true`;
  - cleared/zero expense → DELETE `204`;
  - `ACCOUNTING` DELETE → `403`.
- Browser verification (isolated fixtures `G2611-04…06`, `localdev` ADMIN):
  - Default `Reikia patvirtinti` showed no `Be partijų` rows.
  - `Visos` showed all batches plus one row per empty receipt; empty rows showed
    the code/date/supplier, `Be partijų`, and `—` for batch-specific cells.
  - `G2611-06` with a 10 € expense showed
    `Negalima ištrinti: užregistruota transporto arba muitinės išlaidų.` and no
    delete button.
  - `Ištrinti priėmimą` opened `Ištrinti priėmimą G2611-04?`; `Atšaukti` left the
    row and API record intact.
  - Confirming `Ištrinti` removed the row, showed the success toast and retained
    `Būsena = Visos`.
  - Resuming `G2611-05` opened `/receiving/[deliveryId]`; adding its first batch
    made `G2611-05 / P01` replace the empty row in `Visos`.
  - `Atstatyti filtrus` returned to `Reikia patvirtinti` and hid the remaining
    batch-less rows.
  - The isolated fixtures were removed afterwards. Snapshots of `G2611-01`,
    `G2611-02` and `G2611-03` (timestamps, creator, supplier, batches, expenses)
    were identical before and after.
- Screenshots in `docs/screenshots/atv-069/`:
  `receipts-default-desktop.png`, `receipts-all-with-empty-desktop.png`,
  `delete-receipt-dialog-desktop.png`, `receipts-after-delete-desktop.png`,
  `empty-receipt-editor-desktop.png`,
  `receipts-first-batch-added-desktop.png`,
  `receipts-reset-default-desktop.png`.

## Unresolved / deliberately out of scope

- No pagination exists; the combined list is fully client-side today.
- Deletion is only for batch-less, expense-free receipts. Deleting batches or
  receipts with recorded expenses is not allowed.
- There is no deletion audit trail; a future audited deletion/recovery workflow
  needs its own requirement.
- The live `G2611-02` and `G2611-03` records are preserved; the operator decides
  whether to delete them.

## Recommended next task

Human review and commit of ATV-066, ATV-067, ATV-068 and ATV-069. Any audit,
pagination or broader deletion scope needs a new confirmed task.
