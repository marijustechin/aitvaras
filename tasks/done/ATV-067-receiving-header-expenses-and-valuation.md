# ATV-067 — Compact batch header, type-specific confirmation, receipt expenses and expense-aware valuation

Status: **READY_FOR_HUMAN_REVIEW** (uncommitted; together with ATV-066).

## Objective

Finish the next receiving improvements in one vertical slice:

1. replace the tall batch summary with a compact header that shows the receipt and
   batch codes once;
2. render and submit only the documentary quantity field that matches the batch's
   stored receiving mode (WEIGHT kg vs PIECE vnt.);
3. record transport and customs once per `Priėmimas`, allocate them across its
   batches and expose the same record from every batch;
4. keep per-batch confirmation authoritative and add the frozen expense share to
   dashboard stock valuation exactly once, without silently rewriting confirmed
   values.

## Implemented

### Compact batch header

- `BatchHeader` is shared by WEIGHT and PIECE detail pages.
- The heading is `Priėmimas GYYMM-NN / PXX` (codes shown once).
- One wrapping facts row follows: `Būsena`, `Priėmimo data`, `Tiekėjas`,
  `Išteklius`, `Sandėlis`, `Faktiškai` (kg or vnt.). Desktop keeps heading +
  actions on one line and facts on the next; mobile wraps naturally.
- Actions beside the heading: `Priėmimo GYYMM-NN išlaidos` (deep link to
  `#priemimo-islaidos` on the receipt page) and `Redaguoti partiją` for PENDING
  batches.

### One type-specific documentary field

- WEIGHT form: `Dokumentinis svoris, kg` + acquisition value + document date/nr;
  comparison `Faktiškai susverta` / `Dokumentuose` / `Skirtumas` in kg.
- PIECE form: `Faktiškai užregistruota` + acquisition value + document date/nr
  and a **documentary-form selector**:
  - `Pagal prekes` (itemised, default for multi-product batches) — one input per
    product (`Prekė | Faktiškai | Dokumentuose | Skirtumas`), producing
    `PieceReconciliationLine` rows and one PIECE discrepancy per mismatched
    product;
  - `Bendras kiekis` (single total, default for a single-product batch) — one
    `Dokumentinis kiekis, vnt.` field and one aggregate PIECE discrepancy when the
    total differs.
  Both modes share `Faktiškai gauta` / `Dokumentuose` / `Skirtumas` in `vnt.`;
  a confirmed itemised batch keeps its per-product table read-only.
- The mode and quantity field are chosen from `Batch.receivingMode`, not from
  registered units.
- Empty documentary input shows `—`; switching batches resets the draft.
- WEIGHT no longer renders or submits documentary pieces.

### Receipt expenses

- New Prisma model `IncomingDeliveryExpense` (one row per `IncomingDelivery`,
  unique `deliveryId`) with separate `transportAmount` / `customsAmount`
  `Decimal(14,2)` and `allocationMethod BY_VALUE | EQUAL`.
- New `Batch.allocatedTransportAmount` / `allocatedCustomsAmount`
  `Decimal(14,2)?` snapshots.
- Migration `20261118160000_delivery_expenses` (enum, table, unique index,
  batch columns).
- Contracts: `delivery-expenses.ts` (saved shape, comma-tolerant amount input,
  method labels), exported from `@aitvaras/contracts`.
- API: `GET /deliveries/:id/expenses` (authenticated) and
  `PUT /deliveries/:id/expenses` (`ADMIN`). A missing record returns
  `0`/`0`/`BY_VALUE`/`updatedAt: null`.
- UI: compact `Priėmimo išlaidos` block on the receipt page (`Transportas, €`,
  `Muitinė, €`, method + Lithuanian basis explanation). Lithuanian decimals such
  as `125,50` are accepted; empty amounts mean zero.

### Allocation and valuation

- Pure allocator `apps/api/src/modules/batches/expense-allocation.ts`:
  - `BY_VALUE`: actual net kg on an all-WEIGHT receipt, actual pieces on an
    all-PIECE receipt;
  - `EQUAL`: equal shares across batches with a positive actual quantity;
  - mixed WEIGHT + PIECE receipts reject `BY_VALUE`
    (`MIXED_RECEIPT_REQUIRES_EQUAL`);
  - transport and customs are allocated separately to the cent with
    largest-remainder rounding; zero-quantity batches are excluded.
- Confirmation (both `reconcile` and `confirm-piece`) freezes that batch's shares
  in the same transaction. Later expense saves never update confirmed batches.
- Stock summary adds `acquisitionAmount + allocatedTransportAmount +
  allocatedCustomsAmount` once per confirmed batch; pending siblings do not
  contribute, and re-saving/reopening cannot double count.
- Receipts without an expense record leave the allocation columns `null` and keep
  their acquisition-only valuation.

## Decisions

- **One shared record per delivery.** Transport/customs are a property of the
  arrival, not of a batch or a formal `GoodsReceipt`.
- **Freeze at confirmation.** The batch's share is a snapshot, matching the
  existing "a CONFIRMED batch is frozen" rule. This deliberately means later edits
  only affect still-pending batches. If a batch was confirmed before any expense
  existed, its frozen share is zero and a later expense remains partly
  unallocated; the receipt UI warns about this instead of silently reassigning it.
- **Both PIECE document forms.** Itemised (`Pagal prekes`) is preserved for
  product-level documents; a single total (`Bendras kiekis`) remains for documents
  that provide only a total. The form defaults follow the batch's product count.
- **No mixed denominator.** kg and pieces are never added; mixed receipts offer
  only equal allocation and explain why.
- **Largest-remainder rounding** for each amount independently so the shares sum
  exactly to the entered total.
- **Compatibility first.** Existing receipts/batches and the legacy per-product
  PIECE API keep working; no destructive migration or backfill of expenses.

## Files changed

### Database / contracts

- `packages/database/prisma/schema.prisma`
- `packages/database/prisma/migrations/20261118160000_delivery_expenses/migration.sql`
- `packages/contracts/src/delivery-expenses.ts` (new)
- `packages/contracts/src/batches.ts`
- `packages/contracts/src/index.ts`

### API

- `apps/api/src/modules/batches/expense-allocation.ts` (new)
- `apps/api/src/modules/batches/expense-allocation.test.ts` (new)
- `apps/api/src/modules/batches/batches.service.ts`
- `apps/api/src/modules/batches/deliveries.controller.ts`
- `apps/api/src/modules/stock/stock-summary.ts`
- `apps/api/src/modules/stock/stock-summary.test.ts`
- `apps/api/src/modules/stock/stock.service.ts`
- `apps/api/test/delivery-expenses.e2e.test.ts` (new)
- `apps/api/test/piece-batches.e2e.test.ts`

### Web

- `apps/web/src/features/manage-batches/ui/batch-details-page.tsx`
- `apps/web/src/features/manage-batches/ui/delivery-expenses.tsx` (new)
- `apps/web/src/features/manage-batches/ui/receiving-delivery.tsx`
- `apps/web/src/features/manage-batches/lib/batch-form.ts`
- `apps/web/src/features/manage-batches/lib/batch-form.test.ts`
- `apps/web/src/features/manage-batches/lib/receiving.test.ts`

### Docs / task

- `AGENTS.md`
- `docs/batches.md`
- `docs/piece-batches.md`
- `docs/receipts.md`
- `docs/stock-summary.md`
- `docs/discrepancies.md`
- `docs/domain-glossary.md`
- `docs/scope.md`
- `TODO.md`
- `docs/screenshots/atv-067/` (layout, live-comparison, itemised PIECE,
  Neatitikimai and expense-freeze evidence)
- this record

## Verification

- `npm run verify` — passed: lint, `db:validate`, typecheck, all tests, API + web
  production builds.
  - API: 27 files / 263 tests passed (includes the new 11-test expense
    integration suite).
  - Web: 31 files / 287 tests passed.
  - Contracts: 15 files / 104 tests passed.
- New integration suite (`apps/api/test/delivery-expenses.e2e.test.ts`, test DB
  `aitvaras_test`, isolated `test_expenses_` fixtures):
  - WEIGHT `BY_VALUE`: 80 € + 20 € over 10/30 kg → `20 + 5` and `60 + 15`;
    stock deltas 125 then 375; re-save and retry confirm do not change stock.
  - WEIGHT `EQUAL`: `40 + 10` each.
  - PIECE `BY_VALUE`: actual pieces give `20 + 5` and `60 + 15`.
  - Mixed receipt: `BY_VALUE` → 400 `MIXED_RECEIPT_REQUIRES_EQUAL`; `EQUAL`
    works; only the confirmed batch's share enters stock (weight 107.50, pieces
    307.50); re-save does not double count.
  - Cent rounding: `0,01`/`0,02` shares sum exactly.
  - Receipts without expenses: zero defaults, null shares, acquisition-only value.
  - PIECE aggregate confirmation: 18 vs 20 requires acknowledgement, confirms,
    stores `documentPieces = 20`, records a `PIECE` discrepancy `−2`.
  - PIECE itemised confirmation: 9 vacuum cleaners + 11 suitcases vs 10 + 10
    records `−1` and `+1` product discrepancies; without acknowledgement it is
    rejected and changes nothing.
  - Expense entered after P01 confirmation: P01 stays at 0, P02 gets 50 of 100,
    50 remains unallocated, dashboard adds only P01's acquisition.
  - Expense revised from 100 to 200 after P01 confirmation: P01 stays at 50,
    P02 gets 100, 50 remains unallocated, dashboard contribution is 450.
  - ADMIN-only PUT; worker GET allowed; invalid amounts rejected; unknown receipt
    404.
- Browser checks with Chrome headless against the local dev servers
  (`localhost:3011` / `localhost:3010`, `localdev` ADMIN):
  - `weight-batch-desktop.png`, `weight-batch-mobile.png` — compact header, one
    kg field, natural mobile wrap.
  - `weight-comparison-desktop.png` — 199,800 kg vs 200,000 kg → `−0,200 kg`.
  - `piece-comparison-desktop.png` — 18 vnt. vs 20 vnt. → `−2 vnt.`.
  - `receipt-expenses-desktop.png`, `receipt-expenses-mobile.png` — shared block,
    `125,50` persisted with a comma, method basis text, mobile stacking.
  - Temporary dev-DB screenshot fixtures (one PIECE batch and its receipt
    expenses in `G2611-02`, plus a voided demo line) were removed afterwards; the
    pre-existing `G2611-01 / P01` batch and all master data were preserved.

## Follow-up verification (review feedback, 2026-11-18)

Both checks used **isolated** dev-DB fixtures (`G2611-04`…`G2611-07`, all removed
after the screenshots). The live `G2611-01` receipt was not modified: its state was
captured before and after cleanup and was identical (`PENDING`, 5 packages, no
documentary values). Master data was untouched.

### 1. Itemised PIECE document: 9 vacuum cleaners + 11 suitcases vs 10 each

Isolated `G2611-04 / P01` (PIECE, two item lines, no expenses).

| Prekė | Faktiškai | Dokumentuose | Skirtumas |
|---|---|---|---|
| Dulkių siurblys "Opa" | 9 vnt. | 10 vnt. | `−1 vnt.` |
| Lagaminas paprastas | 11 vnt. | 10 vnt. | `+1 vnt.` |

- The operator can enter **`Pagal prekes`** with 10 and 10; this is the default
  for a multi-product batch. The same batch also offers **`Bendras kiekis`**
  (single `Dokumentinis kiekis, vnt.` field) for a document that provides only a
  total; entering 20 there shows a 0 total difference.
- Because the totals are 20/20, the total-only view would confirm with no
  discrepancy; the itemised view is what exposes the `−1 / +1` product mismatch.
- Confirmation with the acknowledgement dialog recorded **two OPEN PIECE
  discrepancies**:
  - `G2611-04 / P01`, `Dulkių siurblys "Opa"`, `Trūkumas`, `−1 vnt.`;
  - `G2611-04 / P01`, `Lagaminas paprastas`, `Perteklius`, `+1 vnt.`.
- The confirmed detail keeps the per-product `Dokumentuose` / `Skirtumas` table
  read-only, plus the aggregate `Faktiškai gauta 20 / Dokumentuose 20 /
  Skirtumas 0` summary.
- Screenshots: `piece-itemised-entry-desktop.png`,
  `piece-itemised-entry-mobile.png`, `piece-total-entry-desktop.png`,
  `piece-itemised-confirmed-desktop.png`, `neatitikimai-desktop.png`.

### 2. Expenses entered or revised after P01 confirmation

Both isolated receipts had two 10 kg WEIGHT batches, P01 acquisition 100 € and P02
acquisition 200 €, with `Pagal vertę` and 10 kg each (a 50/50 basis).

**A. No expenses at P01 confirmation, then 100 € transport entered**

| Result | Value |
|---|---|
| UI permits saving 100 € after P01 is `CONFIRMED` | yes, no block |
| P01 frozen transport share | **0 €** (`allocatedTransportAmount = null`) |
| P02 share (prospective at its confirmation) | **50 €** |
| Unallocated balance | **50 €** |
| Dashboard contribution from the receipt | **100 €** (P01 acquisition + 0; P02 is still pending and excluded) |

The expense block shows:
`Dalis šio priėmimo partijų jau patvirtinta. Jų išlaidų dalis įšaldyta ir nesikeis; pakeitimai taikomi tik laukiančioms partijoms, todėl gali susidaryti nepaskirstytas likutis.`
No change is blocked; the message explains the frozen share.

**B. Existing 100 € revised to 200 € after P01 confirmation**

| Result | Value |
|---|---|
| P01 frozen at first confirmation | **50 €** (100 € / 2) |
| UI permits revising to 200 € after P01 is `CONFIRMED` | yes, no block |
| P01 after the revision | **50 €** (unchanged) |
| P02 frozen at its confirmation | **100 €** (200 € / 2) |
| Frozen total | **150 €** |
| Unallocated balance | **50 €** (200 − 50 − 100) |
| Dashboard contribution from the receipt | **450 €** (100 + 50 + 200 + 100) |

The global dashboard value before confirming P02 was 250 € and 550 € afterwards
(the 300 € difference is P02's acquisition plus its frozen share). The same
operator-facing warning is shown; again nothing is blocked, because the confirmed
share is a frozen snapshot rather than a recomputation.

Screenshots: `expenses-after-confirm-desktop.png`,
`expenses-revised-after-confirm-desktop.png`.

Both expense scenarios are also asserted in
`apps/api/test/delivery-expenses.e2e.test.ts`, and the 9 + 11 vs 10 + 10 itemised
case in `apps/api/test/piece-batches.e2e.test.ts`.


## Unresolved / deliberately out of scope

- Reallocating or correcting a **confirmed** batch's frozen expense share is not
  implemented; a future audited correction/reallocation workflow is required
  before it is allowed. An unallocated balance created by a late or revised
  expense is reported but not automatically reassigned.
- Mixed receipts cannot use proportional allocation (by design); no common
  kg/piece denominator exists.
- Expense editing is ADMIN-only. There is no approval/audit trail for expense
  changes yet.
- No supplier invoice, VAT, currency, accounting or payment integration.

## Recommended next task

Human review and commit of ATV-066 + ATV-067. Any further scope (e.g. an audited
post-confirmation expense correction) needs its own confirmed requirement and
task.
