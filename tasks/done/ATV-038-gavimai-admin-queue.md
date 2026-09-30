# ATV-038 — Gavimai admin queue

- **Status:** done (uncommitted; for human review)
- **Scope:** information-architecture and admin-workflow cleanup
- **Depends on:** ATV-020/021 (receipts/placement), ATV-030 (reconciliation), ATV-031/032/033/034 (worker receiving), ATV-037 (admin boundary)

## Objective

Make the receiving domain boundary explicit in the UI: warehouse workers create
physical incoming batches through `Registruoti sandėlyje`; ADMIN reviews received
batches and performs formal documentary reconciliation in a renamed, filterable
queue — without a parallel manual receipt/batch creation path.

## 1. Terminology

- Top-level navigation label `Pajamavimas` → **`Gavimai`** (route `/receipts`
  unchanged, `GAVIMAI_ACTION`).
- Landing heading → **`Gautos partijos`** (`GAVIMAI_HEADING`).

## 2. Removed UI

- The manual Goods Receipt creation form (supplier/resource/quantity/unit/price/
  warehouse/location, `Pridėti eilutę`, `Išsaugoti`) — and with it the whole
  `features/manage-receipts` UI (create form, receipts list, receipt detail) plus
  the `/receipts/[id]` route. The `/receipts` API module and the
  `GoodsReceipt`/`GoodsReceiptLine` model remain.
- The ADMIN batch-create form (`Pradėti partiją`) and the `/receipts/batches`
  list page; `features/manage-batches/ui/batches-page.tsx` removed.

## 3. `Gavimai` list / work queue

`/receipts` now renders `GavimaiPage`: it opens directly on the received-batch
queue (no intermediate creation screen). Columns: `Partija`, `Priėmimo data`,
`Tiekėjas`, `Išteklius`, `Sandėlis`, `Maišai / kiekis`, `Būsena` (with the
confirmation date as muted subtext when confirmed) and a `Peržiūrėti` action
linking to `/receipts/batches/[id]`.

## 4. Filters

Client-side over the small received-batch dataset (`lib/batch-list.ts`, no new
framework):

- **Status** — `Reikia patvirtinti` (**default**; `PENDING` + `DISCREPANCY`),
  `Laukiama patvirtinimo` (`PENDING`), `Neatitikimas` (`DISCREPANCY`),
  `Patvirtinta` (`CONFIRMED`), `Visos`.
- Supplier, resource, warehouse (options derived from the loaded batches).
- Arrival/receipt date range (`from`/`to`, inclusive).
- Batch-code search (case-insensitive).

## 5. Role separation

- `WAREHOUSE_WORKER`: `Registruoti sandėlyje` only (`/receiving`); `Gavimai` is
  hidden from the navigation; no documentary/financial confirmation.
- `ADMIN`: `Gavimai` queue/history, filters, read-only unit inspection, formal
  reconciliation. No physical batch-create path here.
- Server authorization unchanged (the API still enforces `ADMIN` for reconcile
  and `ADMIN`/`WAREHOUSE_WORKER` for batch/bag creation).

## 6. GoodsReceipt internally

`GoodsReceipt`/`GoodsReceiptLine` remain the **internal formal-document model**.
Reconciliation (`resolveReceiptLine`, ATV-037) reuses or creates them; the UI no
longer exposes or manually creates them. Documented in `docs/receipts.md`
(internal formal-document status) and `docs/batches.md`.

## Files changed

- New: `features/manage-batches/lib/batch-list.ts` (+test),
  `features/manage-batches/ui/gavimai-page.tsx`.
- Changed: `widgets/app-shell/model/navigation.ts` (+test),
  `entities/batch/batch.ts` (+test), `features/manage-batches/index.ts`,
  `app/receipts/page.tsx`.
- Removed: `features/manage-receipts/**`, `app/receipts/[id]/page.tsx`,
  `app/receipts/batches/page.tsx`, `features/manage-batches/ui/batches-page.tsx`.
- Docs: `receipts.md`, `batches.md`, `domain-glossary.md`, `authorization.md`,
  `TODO.md`; this record.

## Tests

- `batch-list` (web, +11): heading/default queue; `statusesForFilter`
  (`Reikia patvirtinti` = PENDING + DISCREPANCY; individual statuses); filtering
  by status/supplier/resource/warehouse/arrival range/code; distinct sorted
  filter options; `batchDetailHref`.
- `navigation` (updated): `Gavimai` visible to administrative roles, hidden from
  `WAREHOUSE_WORKER`; worker navigation unchanged.
- `entities/batch` (+1): `GAVIMAI_ACTION` label/route.
- Worker `Registruoti sandėlyje` tests remain unchanged and passing.
- No brittle CSS tests.

## Verification

- `pnpm verify` green: contracts **66**, web **183**, API **173**; lint, Prisma
  validate, typecheck, Next + Nest builds.
- `git diff --check` clean.
- `/sandelys` untouched; no commit/push.

## Limitations

- Filtering is client-side; if the received-batch dataset grows, server-side
  filtering/pagination becomes worthwhile.
- The `/receipts` API endpoints remain but are no longer used by the web UI (kept
  as the internal formal-document persistence surface).
