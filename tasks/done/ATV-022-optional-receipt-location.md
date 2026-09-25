# ATV-022 — Warehouse required, warehouse location optional on receipts

**Status:** done
**Date:** 2026-09-21
**Target repository:** `/aitvaras`
**Workspace ID:** O-060

## Objective

Adjust the uncommitted O-058/O-059 receipt placement model: **warehouse is
required** per receipt line, **warehouse location is optional**.

## Changes

### Database

- `GoodsReceiptLine.warehouseId` stays **required**; `warehouseLocationId`
  becomes **nullable** (`WarehouseLocation?` relation).
- Forward migration `20260921110842_optional_receipt_location`
  (`ALTER COLUMN warehouse_location_id DROP NOT NULL`; the FK is recreated as
  `ON DELETE SET NULL` for the now-optional relation). Committed migrations
  untouched; the earlier uncommitted `warehouse_placement` migration was **not**
  rewritten (rewriting an applied migration would require a destructive
  `migrate reset` of the dev DB).

### Contracts

- `CreateGoodsReceiptLineRequestSchema`: `warehouseId` required;
  `warehouseLocationId` optional via `optionalLocationId` — absent field or
  explicit `""` both normalise to `undefined`; a supplied value must be a UUID.
  Unknown fields still rejected.
- `GoodsReceiptLineSchema`: `warehouseLocationId` and `warehouseLocationName`
  are now nullable.

### API

- `receipts` mapper returns nullable `warehouseLocationId` /
  `warehouseLocationName`.
- `assertActivePlacement`: always validates each line's warehouse (exists +
  active); validates a location **only when supplied** (exists + active +
  belongs to the selected warehouse). Lines without a location are valid.
  Atomic create unchanged; `warehouseLocationId` persisted as `null` when absent.

### Web

- `receipt-form` validation: warehouse required (`Kiekvienoje eilutėje
  pasirinkite sandėlį.`); location no longer required. Payload keeps the
  (possibly empty) location id.
- Receipt form: `Sandėlis *` marked required; `Vieta` not required, disabled
  until a warehouse is chosen, lists only that warehouse's active locations,
  offers `— Be konkrečios vietos —`, and is cleared when the warehouse changes
  (no auto-selection).
- Receipt detail: new `receiptLocationLabel` (entities/receipt) renders the
  location name or `—` when none was recorded.

## Files changed

`packages/database/prisma/schema.prisma` + migration
`20260921110842_optional_receipt_location/`; `packages/contracts/src/receipts.ts`
(+test); `apps/api/src/modules/receipts/{receipt.mapper.ts,receipts.service.ts}`;
`apps/api/test/receipts.e2e.test.ts`; `apps/web/src/entities/receipt/*`;
`apps/web/src/features/manage-receipts/**`; docs `receipts.md`, `warehouses.md`,
`domain-glossary.md`, `scope.md`, `architecture.md` (migration count);
`tasks/done/ATV-022-optional-receipt-location.md`.

## Verification

- `pnpm verify` → **exit 0**. Tests: API **126 / 18**, web **80 / 14**,
  contracts **38 / 7**.
- Test-DB isolation intact (dev DB fingerprint identical before/after verify).
- Smoke: receipt saved with a warehouse and **no** location (201; location id and
  name null; total 250); receipt saved with a location (201; location name set);
  mismatched warehouse/location → `400` ("nepriklauso"); line missing a warehouse
  → `400`; detail shows the warehouse and a null location; `/partners`,
  `/resources`, `/users`, `/auth/me` still 200. Smoke data removed;
  `localdev/localdev` unchanged.
- `git diff --check` exit 0; no secrets; `/sandelys` clean.

## Next step

None confirmed.
