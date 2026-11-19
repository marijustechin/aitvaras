# ATV-068 — Single receiving list, unfinished receipts and parent-receipt navigation

Status: **READY_FOR_HUMAN_REVIEW** (uncommitted, together with ATV-066/067).

## Objective

1. Trace the two empty live receipts `G2611-02` and `G2611-03` and establish how
   the UI creates a receipt.
2. Make `/receipts` the single receiving list; point the sidebar and every
   `Priėmimų sąrašas` action to it; keep filters on return.
3. Preserve access to started receipts without a batch, while making `/receiving`
   redirect to `/receipts` and keeping the blank new-receipt form record-free.
4. Give the batch editor a destination-accurate parent action and show the
   `Priėmimas G…` heading once.

## Trace: G2611-02 and G2611-03

Read-only inspection of the live development database (no records were changed
during the investigation).

| Receipt | Created (UTC) | Creator (`createdById`) | Batches | Expense |
|---|---|---|---|---|
| G2611-01 | 2026-11-18 12:12:24.490 | `localdev` / Local Developer (`67ec47bc-…`) | 1 — `P01`, created 12:13:53.510, `PENDING` | none |
| G2611-02 | 2026-11-18 12:13:27.778 | `localdev` / Local Developer | 0 | none |
| G2611-03 | 2026-11-18 13:57:26.241 | `localdev` / Local Developer | 0 | none |

All three use supplier `Nežinomas`, arrival date `2026-11-17T22:00:00.000Z`
(displayed `2026-11-18`). `createdById` is recorded; there is **no audit/request
log** and no stored “created by which UI action” field. The exact click is
therefore not recorded for either empty receipt. `G2611-02`'s timing strongly
suggests a submitted new-receipt form; `G2611-03` has no surrounding action from
which even that can be inferred.

### What the records establish

- Only `POST /deliveries` creates an `IncomingDelivery`; adding a batch calls
  `POST /deliveries/:id/batches` and creates a `Batch`, not a delivery.
- Both empty receipts therefore came from the explicit new-receipt submit
  (`Pradėti priėmimą`), not from opening `/receiving/new` and not from adding the
  first batch.
- `G2611-02` was created 29 seconds before `G2611-01/P01`; this is consistent with
  a started-then-abandoned receipt while another receipt was being worked on.
- `G2611-03` has no surrounding batch/delivery action close enough to infer the
  exact click. **The original action cannot be established from available
  records** beyond “created through `POST /deliveries` by `localdev`”.

### Why the two lists differed

- **`/receipts` (`Gautos partijos`)** uses `GET /batches` →
  `BatchesService.list()`, which selects `Batch` rows with their delivery. A
  delivery with zero batches has no row, so `G2611-02` and `G2611-03` never
  appeared there.
- **The former `/receiving` list** used `GET /deliveries` →
  `listDeliveries()`, which returns every delivery with derived
  `batchCount`/`pendingBatchCount`; `openReceivingDeliveries` keeps
  `batchCount === 0 || pendingBatchCount > 0`. The empty receipts therefore
  appeared in `Nepatvirtinti priėmimai`.

### Reproduction in an isolated database

Added `batches.e2e.test.ts` coverage on the dedicated `aitvaras_test` database:
a created delivery has `batchCount = 0`, is present in `GET /deliveries`, is
absent from `GET /batches`; after resolving its first batch, `batchCount` becomes
1 and the batch appears in `GET /batches`.

## Implemented

### One receiving list

- `app/receiving/page.tsx` now redirects the exact `/receiving` index to
  `/receipts`.
- `ReceivingPage` is now only the `/receiving/new` form. The old choose/list mode
  and its duplicate open-receipt table were removed.
- The sidebar already targets `GAVIMAI_ACTION.href` (`/receipts`); it remains the
  single `Priėmimas` destination and stays active on `/receiving/...` routes.
- Every `← Priėmimų sąrašas` action in the receipt/batch screens now links to
  `/receipts` (top and bottom actions).
- The list filter inputs gained stable IDs (`filter-status`, `filter-supplier`,
  `filter-resource`, `filter-warehouse`, `filter-arrival-from`,
  `filter-arrival-to`, `filter-code`). The existing sessionStorage restoration
  remains the source of truth, so the filters survive
  `Gautos partijos → batch → Redaguoti partiją → Priėmimų sąrašas` and a direct
  editor URL followed by the back action.

### Started receipts without batches

- `/receipts` also loads `GET /deliveries`.
- When any delivery has `batchCount === 0`, a compact
  **`Pradėti priėmimai be partijų`** section appears above the filters. Each row
  shows the code, supplier and arrival date and offers **`Tęsti priėmimą`**
  (`/receiving/[deliveryId]`).
- The section disappears when no empty deliveries remain. After the first batch is
  added, the delivery leaves the section and its batch appears in
  `Gautos partijos` under the active filters.
- Opening `/receiving/new` creates nothing; only `Pradėti priėmimą`
  (`POST /deliveries`) creates the receipt.

### Batch editor navigation

- The `Priėmimo turinys` heading remains above the batch table.
- The navigation button in the batch editor is now:
  - **`Redaguoti priėmimą`** when the batch is `PENDING` and the operator may
    receive/edit;
  - **`Peržiūrėti priėmimą`** otherwise (confirmed/read-only).
- It links to `/receiving/[deliveryId]` using the loaded batch's own
  `deliveryId`, so it opens the exact parent receipt.
- The duplicated inner `Priėmimas G…` heading was removed; the page heading is
  shown once.

## Files changed

### Web

- `apps/web/src/app/receiving/page.tsx`
- `apps/web/src/app/receiving/new/page.tsx`
- `apps/web/src/features/manage-batches/ui/receiving-page.tsx`
- `apps/web/src/features/manage-batches/ui/receiving-delivery.tsx`
- `apps/web/src/features/manage-batches/ui/gavimai-page.tsx`
- `apps/web/src/features/manage-batches/lib/receiving.ts`
- `apps/web/src/features/manage-batches/lib/receiving.test.ts`

### API test

- `apps/api/test/batches.e2e.test.ts`

### Docs / task

- `docs/batches.md`
- `docs/frontend-architecture.md`
- `TODO.md`
- `docs/screenshots/atv-068/`
- this record

## Decisions

- **One list, one creation point.** `/receipts` is the only receiving list;
  `/receiving/new` is the only form that creates a receipt, and the blank form is
  deliberately record-free.
- **Keep unfinished receipts visible.** Zero-batch receipts are legitimate
  started work (`POST /deliveries` already created them), so they stay reachable
  from `/receipts` instead of being hidden or deleted.
- **Derive the empty section from `batchCount`.** No new delivery status is
  introduced; the same child-batch derivation already used by the API is reused.
- **Keep the batch editor's parent action status-aware.** A pending batch that the
  operator can edit says `Redaguoti priėmimą`; a frozen/read-only batch says
  `Peržiūrėti priėmimą`.
- **Preserve filters with the existing sessionStorage key.** No URL/query
  parameter expansion was introduced; the existing operator session behaviour is
  retained and was verified after both normal and direct editor entry.

## Verification

- `npm run verify` passed: lint, `db:validate`, typecheck, tests and builds.
  - API: 27 files / **264** tests.
  - Web: 31 files / **288** tests.
  - Contracts: 15 files / **104** tests.
- New API test: delivery exists with zero batches, appears in `GET /deliveries`,
  is absent from `GET /batches`, then gains its first batch and appears in both.
- Browser verification (Chrome headless, `localdev` ADMIN, live receipts plus one
  isolated empty fixture):
  - `/receiving` → `/receipts`.
  - `/receipts` showed `Pradėti priėmimai be partijų` with `G2611-02`,
    `G2611-03` and the isolated fixture.
  - Filters `Būsena = Visos`, `Tiekėjas = Nežinomas`, `Partijos kodas = P01`
    survived `Gautos partijos → batch → Redaguoti partiją → ← Priėmimų sąrašas`.
  - The same filters survived opening the editor URL directly and using the back
    action.
  - `Redaguoti priėmimą` opened
    `/receiving/5ee594b5-f8aa-4d1d-9440-fac2841f47e4` (G2611-01), with exactly one
    visible `Priėmimas G2611-01` heading and `Priėmimo turinys` above the batch
    table.
  - `Tęsti priėmimą` on `G2611-02` opened its zero-batch receipt and the
    `Nauja partija` form (`Priėmimas G2611-02` heading once).
  - Opening and leaving `/receiving/new` kept the delivery count at 4 before,
    during and after; no record was created.
  - Adding the first batch to the isolated fixture removed it from the empty
    section and made its `G2611-04 / P01` batch visible in `Gautos partijos`.
  - The fixture was then removed. The live `G2611-01`, `G2611-02` and `G2611-03`
    snapshots (timestamps, creator, supplier, batches, expenses) were identical
    before and after.
- Screenshots in `docs/screenshots/atv-068/`:
  `receipts-single-list-desktop.png`, `batch-editor-parent-action-desktop.png`,
  `receipt-parent-desktop.png`, `receipts-filters-restored-desktop.png`,
  `zero-batch-receipt-desktop.png`, `new-receipt-blank-desktop.png`,
  `receipts-after-first-batch-desktop.png`.

## Unresolved / deliberately out of scope

- The exact UI click/request context is not stored, so `G2611-03`'s original
  action cannot be established beyond “created via `POST /deliveries` by
  `localdev`”. Adding an audit log was not part of this task.
- There is no “abandon/delete empty receipt” action. Started receipts remain
  visible until completed; a future cleanup workflow needs its own requirement.
- The live `G2611-02` and `G2611-03` records are intentionally preserved.
- Filter state remains tab/session-scoped (sessionStorage); cross-tab sharing was
  not requested.

## Recommended next task

Human review and commit of ATV-066, ATV-067 and ATV-068. Any further receipt
cleanup/audit behaviour needs a new confirmed task.
