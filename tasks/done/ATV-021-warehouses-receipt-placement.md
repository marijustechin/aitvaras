# ATV-021 — Warehouses, Warehouse Locations & Receipt Placement

**Status:** done
**Date:** 2026-09-21
**Target repository:** `/aitvaras`
**Workspace ID:** O-059

## Objective

Extend the uncommitted O-058 Pajamavimas work with physical warehouse placement:
first-class `Warehouse` + `WarehouseLocation`, and per-line receipt placement
(warehouse + location). Still **no stock**.

## Domain decisions

- **Sandėlis (Warehouse)**: `id`, `name`, `active`, timestamps. Deactivated,
  never hard-deleted. No address/code/manager/capacity yet.
- **Sandėlio vieta (WarehouseLocation)**: `id`, `warehouseId`, `name`, `active`,
  timestamps. **Always belongs to exactly one warehouse.** Deactivated, never
  hard-deleted.
- **Uniqueness**: location names are **not globally unique**; unique within a
  warehouse via `(warehouseId, name)`. Case-sensitive (PostgreSQL default); no
  normalisation subsystem — documented `docs/warehouses.md`.
- **Placement is per receipt line** (`warehouseId` + `warehouseLocationId`),
  never only at header level; different lines may use different warehouses.
- **Server-enforced**: location must belong to the selected warehouse; warehouse
  and location must exist and be active for a new line. Historical receipts stay
  readable after deactivation.
- **No stock**: placement is part of the receipt record only; saving does not
  update any stock ledger.

## Database

- `Warehouse` (`warehouses`): UUID, name, active, timestamps; index on name.
- `WarehouseLocation` (`warehouse_locations`): UUID, `warehouseId`, name,
  active, timestamps; `@@unique([warehouseId, name])`, index on warehouseId.
- `GoodsReceiptLine` gained required `warehouseId` + `warehouseLocationId`
  (FKs **RESTRICT**), with indexes.
- New forward migration `20260921110025_warehouse_placement`. The O-058
  `goods_receipts` migration was **not** rewritten (no reset). One pre-release
  dev receipt (2 lines) written under the O-058 model was **removed** so the new
  required placement columns could be added without inventing placement data;
  partners/resources/users/packing forms were preserved.

## Contracts

`packages/contracts/src/warehouses.ts`: `Warehouse`, `WarehouseLocation`,
`WarehouseWithLocations`, `CreateWarehouse`, `UpdateWarehouse`,
`CreateWarehouseLocation`, `UpdateWarehouseLocation` (strict; blank names
rejected; updates require ≥1 field). `receipts.ts` lines now require
`warehouseId` + `warehouseLocationId`, and read lines include warehouse/
location id + name. Tests updated.

## API

`apps/api/src/modules/warehouses/` (controller/service/mapper/module); wired
into `AppModule`. Locations stay in the warehouses module (owned by warehouse).

| Endpoint | Requirement |
|---|---|
| `GET /warehouses`, `GET /warehouses/:id` | authenticated |
| `POST /warehouses`, `PATCH /warehouses/:id` | `ADMIN` |
| `GET /warehouses/:id/locations` | authenticated |
| `POST /warehouses/:id/locations` | `ADMIN` |
| `PATCH /warehouses/:warehouseId/locations/:locationId` | `ADMIN` |

No DELETE. Duplicate location name within a warehouse → `409`. `PATCH` a
location through the wrong parent → `404`. `receipts` service now validates
warehouse/location existence, active state and the warehouse↔location match per
line; creation remains atomic.

## Web (FSD-lite)

- `entities/warehouse/`: `activeWarehouses`, `activeLocations`,
  `locationsForWarehouse`, `isLocationInWarehouse`, empty-state texts (+tests).
- `features/manage-warehouses/`: `WarehousesPage` (list + ADMIN create),
  `WarehouseDetailsPage` (rename/activate + location add/rename/activate) + bar.
- Routes `/warehouses`, `/warehouses/[id]`; navigation `Sandėliai` between
  `Ištekliai` and `Pajamavimas`.
- Receipt form: each line now has `Sandėlis` + `Vieta`; the location selector is
  disabled until a warehouse is chosen and lists only that warehouse's active
  locations; changing the warehouse clears the location. Two-row line layout
  (no horizontal overflow); detail view shows warehouse/location columns.

## Tests

- API `warehouses.e2e.test.ts` (8) and updated `receipts.e2e.test.ts` (11):
  warehouse read/write authz; create/rename/deactivate; inactive readable;
  locations CRUD; same name in different warehouses allowed; duplicate in same
  warehouse → 409; parent ownership (wrong parent 404, missing parent 404);
  receipt placement validation (inactive/missing/mismatched warehouse/location),
  multiple lines different warehouses, atomic failure, historical readability.
- Web: warehouse selectors, dependent location behaviour, per-line independence,
  validation, navigation/active state.
- Totals: **API 125 / 18, web 76 / 14, contracts 38 / 7.**

## Verification

- `pnpm verify` → **exit 0**; routes include `/warehouses`, `/warehouses/[id]`.
- Test-DB isolation intact (dev DB fingerprint identical before/after verify).
- Smoke (dev API/web): created Warehouse A (2 locations) and B (same-named
  location allowed); created a 2-line receipt placing each line in a different
  warehouse (`total=1859`); mismatched warehouse/location rejected
  (`400`, "nepriklauso"); deactivated a location (gone from selection); the saved
  receipt still displayed it; `/partners`, `/resources`, `/users`, `/auth/me`
  200; web `/warehouses` + `/receipts` 200; built JS contains `Sandėliai`/
  `Sandėlio vietos`. Smoke data removed; `localdev/localdev` unchanged.
- `git diff --check` exit 0; no secrets; `/sandelys` clean.

## Notes

- Migration consolidation was **not** used: rewriting the applied (uncommitted
  but already applied) O-058 migration would require a destructive `migrate
  reset` of the dev database. A separate forward migration was added instead.
- Dev DB contains live review data created outside this task (a partner, a
  resource, an extra user, two warehouses); the automated suite did not mutate it.

## Next step

None confirmed.
