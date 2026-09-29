# ATV-029 — Receiving batches and bags (Partijos ir maišai)

- **Status:** done (uncommitted; for human review)
- **Scope:** first slice of the confirmed inventory direction (= batch/lot +
  per-bag handling units)
- **Depends on / follows:** ATV-020…ATV-022 (receipts & placement), ATV-028
  (managed categories)

## Objective

Implement the first Aitvaras slice of the confirmed inventory/production
principles: **incoming batch/lot** registration with **individual physical
bags/handling units**, each with a unique barcode, registered bag-by-bag while
the batch is pending. Explicitly **not** stock, movements, production lineage,
costing, confirmation or reconciliation.

## Decisions

- **Batch is independent of GoodsReceipt.** A batch records the physical
  delivery (resource, supplier, warehouse, arrival date) and can later be
  reconciled with a receipt **without duplicating quantities**. No `receiptId`
  FK is added yet — the batch↔receipt link is an intended, documented follow-up
  rather than a speculative field. (`docs/batches.md`.)
- **Bag weight is measured per bag** (`Decimal(14,3)`), because bags of one batch
  may differ in weight (confirmed principle 3).
- **The barcode identifies the physical unit only and encodes no business data**
  (no supplier/resource/date/batch/cost); relationships carry meaning. Chosen as
  a 13-digit **EAN-13-shaped** code (GS1 `20` restricted-circulation prefix + 10
  random digits + valid check digit), not the legacy generator (ADR-004).
- **Batch code is system-generated, human-readable, unique**
  (`P-<year>-<6-digit sequence>`), generated in the API with retry on unique
  conflict.
- **Totals are derived, never stored**: `bagCount` and `totalWeight` are computed
  from bag rows (grouped sum for lists; row sum for detail) and serialised as a
  decimal string.
- **Status concept is stable in data but only `PENDING` is functional.**
  `CONFIRMED`/`DISCREPANCY` exist so the future confirmation step does not require
  a data migration; new bags may be added only while `PENDING`.
- **Authorization** reuses the existing role guard (no new permission framework):
  reads are authenticated; starting a batch and adding bags are
  `ADMIN`/`WAREHOUSE_WORKER` (operational shop-floor roles).
- **Test database isolation** preserved; the migration is purely additive.

## Data model (migration `receiving_batches_and_bags`)

```text
BatchStatus  PENDING | CONFIRMED | DISCREPANCY            (default PENDING)

batches
├── id (uuid pk)
├── code (unique varchar(32))
├── resource_id -> resources            (RESTRICT)
├── supplier_id -> business_partners     (RESTRICT)
├── warehouse_id -> warehouses           (RESTRICT)
├── arrival_date (timestamp)
├── status (BatchStatus, default PENDING, indexed)
├── created_by_id -> users               (RESTRICT)
└── created_at / updated_at

bags
├── id (uuid pk)
├── barcode (unique varchar(32))
├── batch_id -> batches                  (RESTRICT)
├── weight (decimal(14,3))
├── warehouse_location_id -> warehouse_locations (nullable, SET NULL)
├── created_by_id -> users               (RESTRICT)
└── created_at / updated_at
```

Additive only: new enum + two new tables + indexes/FKs. Applied to the isolated
`aitvaras_test` DB during tests; no existing table altered.

## API (`apps/api/src/modules/batches/`)

| Capability | Endpoint | Requirement |
|---|---|---|
| List (optional `?status=`) | `GET /batches` | authenticated |
| Detail (with bags) | `GET /batches/:id` | authenticated |
| Start a batch | `POST /batches` | `ADMIN` or `WAREHOUSE_WORKER` |
| List a batch's bags | `GET /batches/:id/bags` | authenticated |
| Add a bag | `POST /batches/:id/bags` | `ADMIN` or `WAREHOUSE_WORKER` |
| Bag by barcode (scanner) | `GET /bags/by-barcode/:barcode` | authenticated |

Server-side validation (never trusting the UI): resource/warehouse exist and are
active; supplier exists, is active and has `SUPPLIER`; `weight` > 0; a supplied
location exists, is active and belongs to the batch's warehouse; bags only into a
`PENDING` batch; unknown fields / invalid status → `400`; unknown ids → `404`.
Code/barcode generation lives in module-local helpers (`batch-code.ts`,
`bag-barcode.ts`) with the EAN-13 check digit as a pure, unit-tested function.

## Web (FSD-lite)

- `entities/batch` — status label, open-check, weight/date formatting, location
  label.
- `features/manage-batches` — `BatchesPage` (create + filterable list) and
  `BatchDetailsPage` (add bags, bags table, label preview/print via
  `window.print()`). Form logic in `lib/batch-form.ts`.
- Routes `/receipts/batches` and `/receipts/batches/[id]`, reached from
  `Pajamavimas` (`Partijos →`). Creation controls shown only to
  `ADMIN`/`WAREHOUSE_WORKER`.

## Contracts

New `@aitvaras/contracts` `batches.ts`: `BATCH_STATUSES` + labels,
`BatchSchema`, `BatchDetailSchema`, `BagSchema`, strict
`CreateBatchRequestSchema` (ISO arrival datetime) and `CreateBagRequestSchema`
(positive decimal weight; empty location → omitted).

## Tests

- Contracts `batches.test.ts` (+9).
- API `test/batches.e2e.test.ts` (+12): auth/role, create + generated code,
  EAN-13 validity/uniqueness, derived totals, barcode lookup, location rules,
  non-pending rejection, ineligible refs, invalid payloads, status filter,
  404/400.
- Web `entities/batch` (+7) and `features/manage-batches/lib` (+8).

## Verification

- `pnpm verify` green (lint, Prisma validate, typecheck, tests, builds):
  contracts **57**, web **130**, API **158** (was 47 / 108 / 137).
- `git diff --check` clean.
- No `/sandelys` change; no commit/push (left for review).

## Explicitly out of scope (recorded, not built)

Confirmation/reconciliation (`CONFIRMED`/`DISCREPANCY`), document-vs-measured
weight, the batch↔receipt structural link, scan-driven warehouse movements,
stock balances, splitting/merging handling units and EAN lineage to children, a
rendered scannable barcode **graphic** (the label prints the barcode as text),
production transformation lineage, and batch/output-lot costing.

## Unresolved / recommended next

- Decide and model the **batch↔receipt link** (nullable FK vs join) — needs the
  business rule that ties a bag-by-bag batch to a formal `Pajamavimas`.
- Confirmation/reconciliation step and discrepancy handling.
- Barcode **label rendering** (real scannable graphic) and printer handling.
- Scan-driven movement will likely need a dedicated later slice (its own module)
  once the movement model is confirmed.
