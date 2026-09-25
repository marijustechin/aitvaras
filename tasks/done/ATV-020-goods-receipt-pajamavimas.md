# ATV-020 — Initial Goods Receipt (Pajamavimas)

**Status:** done
**Date:** 2026-09-21
**Target repository:** `/aitvaras`
**Workspace ID:** O-058

## Objective

First minimal **Pajamavimas** (goods receipt) workflow: a reviewable record of
the physical receipt of resources from one supplier partner, with 1..n lines.
No stock, locations, production, invoices, accounting, lots, barcodes or
payments.

## Domain decisions

- A **Pajamavimas** records physical receipt of resources from a supplier. It is
  **not** an accounting purchase, supplier invoice, payment, stock ledger or
  warehouse balance. The term `Pajamavimas` is used deliberately (not
  `Pirkimas` / `Išteklių pirkimas`).
- **Saving does not create or modify stock** (no balance/location/ledger/lot/
  barcode/reserved quantity). Documented in `docs/receipts.md`.
- One receipt → exactly one partner (must be active + `SUPPLIER`).
- One receipt → **1..n** lines; each line → resource, quantity, unit, unit price.
- **Units** are fixed: `KG` (kg), `UNIT` (vnt.); default `KG`. No unit
  administration module; no litres/metres/m²/m³ yet.
- **Quantity** > 0, decimal; **unit price** ≥ 0, decimal, per selected unit, EUR
  implicitly (no currency management). Both persisted as `Decimal` and exchanged
  as strings (never floating point).
- **Packing form** is deliberately **not** attached yet (`packingFormId` absent).
- **No status/lifecycle** (`DRAFT`/`POSTED`/`CONFIRMED`/`CANCELLED`) yet.
- Only **active resources** are selectable; historical receipts stay readable
  after a resource is deactivated.

## Database

- `MeasurementUnitKey` enum (`KG`, `UNIT`).
- `GoodsReceipt` (`goods_receipts`): UUID, `partnerId`, timestamps; indexes on
  `partnerId` and `createdAt`.
- `GoodsReceiptLine` (`goods_receipt_lines`): UUID, `goodsReceiptId`,
  `resourceId`, `quantity Decimal(14,3)`, `unit`, `unitPrice Decimal(14,4)`;
  indexes on both FKs.
- FKs: partner → **RESTRICT**, resource → **RESTRICT**, receipt → lines
  **CASCADE**. Forward migration `20260921103418_goods_receipts`. No stock tables.

## Contracts

`packages/contracts/src/receipts.ts`: `MeasurementUnitKey` + labels +
`DEFAULT_MEASUREMENT_UNIT`; `GoodsReceipt`/`GoodsReceiptLine` read shapes
(derived `lineTotal`, `total`); strict `CreateGoodsReceiptRequestSchema`
(valid partner UUID, ≥1 line, valid resource UUIDs, quantity > 0, unit price ≥ 0,
valid unit, unknown fields rejected; decimals as strings). Tests included.

## API

`apps/api/src/modules/receipts/` (controller, service, mapper, module); wired
into `AppModule`.

| Endpoint | Requirement |
|---|---|
| `GET /receipts` | authenticated — newest first |
| `GET /receipts/:id` | authenticated |
| `POST /receipts` | authenticated |

No `PATCH`/`DELETE`. `POST` creates receipt + lines atomically (nested create).
Server-side validation checks the partner exists/active/has `SUPPLIER` and every
resource exists/is active (not relying on UI filtering); clear Lithuanian errors,
no Prisma leakage. Totals derived from stored decimals (never client-supplied).

## Web (FSD-lite)

- `entities/receipt/` — unit labels, EUR/date display formatting, empty-state.
- `entities/partner` — `isActiveSupplier`/`activeSuppliers`; `entities/resource`
  — `activeResources` (selectability predicates).
- `features/manage-receipts/` — `lib/receipt-form.ts` (draft lines, add/remove,
  display totals, validation, payload) + `ui/receipts-page.tsx` (create form +
  recent list) + `ui/receipt-details-page.tsx` (read-only) + barrel.
- Thin routes `/receipts`, `/receipts/[id]`; navigation `Pajamavimas` between
  `Ištekliai` and `Naudotojai` (active for nested routes).
- Responsive: desktop row layout, stacked fields on narrow screens. Success
  feedback `Pajamavimas išsaugotas.`; form resets and list refreshes; submit
  disabled while saving (no duplicate submit).

## Tests

- API `test/receipts.e2e.test.ts` (9): unauth rejected; authenticated list;
  create + derived totals; supplier and supplier+buyer accepted; multiple lines
  atomic; buyer-only/inactive/missing partner rejected; inactive/missing resource
  rejected; zero lines/quantity/unit/price/unknown-field rejected; failed line
  leaves no partial receipt; newest-first ordering; 400/404 ids.
- Web `receipt-form.test.ts` (9): default unit KG, initial one line, add/remove
  (never below one), display totals, validation, payload; plus partner/resource
  selectability and navigation (`Pajamavimas` visible + nested active).
- Totals: **API 115 / 17, web 66 / 13, contracts 32 / 6.**

## Verification

- `pnpm verify` → **exit 0**; build routes include `/receipts`, `/receipts/[id]`.
- Test-DB isolation intact: dev DB fingerprint identical before/after verify.
- Smoke (dev API/web): login; create 2-line receipt from the active supplier
  (`total=1859`, line totals `1775`/`84`); detail shows both lines; buyer-only
  partner rejected (`400`, "neturi tiekėjo vaidmens"); `/partners`, `/resources`,
  `/users`, `/auth/me` still 200; web `/receipts` 200; built JS contains
  `Pajamavimas`/`Vieneto kaina`. Smoke receipt and temp buyer partner removed;
  `localdev/localdev` unchanged.
- `git diff --check` exit 0; no secrets; `/sandelys` clean.

## Notes

- The dev database contains live review data (a partner, a resource and an extra
  user not created by this task); the automated suite did not mutate it.

## Next step

None confirmed. Receipt lifecycle, stock, packing-form link and partner↔resource
transaction models require new confirmed requirements.
