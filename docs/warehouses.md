# Warehouses & Locations (Sandėliai ir vietos)

> Status: **implemented** — task O-059. Physical warehouses and their locations
> as supporting master data, used by goods-receipt placement.

## Model

```text
Sandėlis (Warehouse)
  → 1..n Sandėlio vietų (WarehouseLocation)
```

- **Warehouse** (`Warehouse`): `id`, `name`, `active`, timestamps. Only
  confirmed fields exist — no address, code, manager or capacity yet.
- **WarehouseLocation** (`WarehouseLocation`): `id`, `warehouseId`, `name`,
  `active`, timestamps. **A location always belongs to exactly one warehouse.**

Both are **deactivated, never hard-deleted**, and remain queryable for
historical references. UUIDs throughout.

## Names and uniqueness

- Location names are **not globally unique**: two warehouses may both have
  `Stelažas 1`.
- Uniqueness is enforced **within a warehouse** via `(warehouseId, name)`.
  Creating/renaming a duplicate location in the same warehouse returns `409`.
- Uniqueness is **case-sensitive** (PostgreSQL default, e.g. `Stelažas` vs
  `stelažas` are distinct). We do **not** normalise case — no normalisation
  subsystem is built; if case-insensitive uniqueness is ever required it must be
  a confirmed decision.

## Administration UI

Supporting master data, kept restrained:

- `/warehouses` — `Sandėliai`: list (name, number of locations, status); ADMIN
  can create a warehouse.
- `/warehouses/[id]` — warehouse detail: ADMIN can rename, activate/deactivate,
  and manage its **Sandėlio vietos** (add, rename, activate/deactivate).
- Locations are **owned by their warehouse** and are not a separate top-level
  navigation item; they are managed inside the warehouse detail screen.
- Authenticated non-admin users may view; the create/edit controls are
  ADMIN-only and the server enforces it.

`Sandėliai` is a primary authenticated navigation item
(`Pradžia · Partneriai · Ištekliai · Sandėliai · Pajamavimas · Naudotojai*`),
which keeps the route discoverable.

## Authorization

Reuses the existing role guard — no new permission framework.

| Capability | Endpoint | Requirement |
|---|---|---|
| List warehouses (with locations) | `GET /warehouses` | authenticated |
| Warehouse details | `GET /warehouses/:id` | authenticated |
| Create warehouse | `POST /warehouses` | `ADMIN` |
| Rename / activate / deactivate warehouse | `PATCH /warehouses/:id` | `ADMIN` |
| List locations | `GET /warehouses/:id/locations` | authenticated |
| Create location | `POST /warehouses/:id/locations` | `ADMIN` |
| Rename / activate / deactivate location | `PATCH /warehouses/:warehouseId/locations/:locationId` | `ADMIN` |

No `DELETE`. Locations are addressed through nested routes because they are
owned by their warehouse.

## Use in goods receipts

Receipt **lines** record intended physical placement. The **warehouse is
required** (`GoodsReceiptLine.warehouseId`); a specific **location is optional**
(`warehouseLocationId` nullable). Placement is per line (never only at receipt
header) because one receipt may place different lines in different
warehouses/locations. See [receipts.md](receipts.md).

The server enforces that a location, **when supplied**, belongs to the selected
warehouse; the client's dependent selector is convenience only.

## Not stock

Warehouses/locations here record **intended physical placement as part of the
receipt record only**. This task does **not** create stock balances, movements
or quantities-on-hand; a saved receipt does **not** update any stock ledger.
That logic comes separately after review.

## Related documents

- [receipts.md](receipts.md) — goods receipts and placement
- [scope.md](scope.md) — confirmed scope
- [domain-glossary.md](domain-glossary.md) — terminology
- [backend-architecture.md](backend-architecture.md) — module rules
