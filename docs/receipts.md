# Goods Receipts (Pajamavimas)

> Status: **implemented (first minimal iteration)** — task O-058. Records the
> physical receipt of resources from a supplier partner.

## What a Pajamavimas is (and is not)

A **Pajamavimas** records the **physical receipt of resources from a supplier**.

It is **not** currently:

- an accounting purchase;
- a supplier invoice;
- a payment;
- a stock ledger;
- a warehouse balance.

The word **Pajamavimas** is used deliberately instead of *Pirkimas* /
*Išteklių pirkimas*, because this workflow records physical receipt, not
financial purchasing/accounting.

## Do not model stock yet

Saving a receipt **does not** create or modify warehouse stock. There is no
stock balance, inventory ledger, lot/batch, barcode, available or reserved
quantity, or quantity-per-location. Those are designed separately later.

## Domain model

```text
GoodsReceipt
├── id
├── partnerId
├── createdAt
├── updatedAt
└── lines[]

GoodsReceiptLine
├── id
├── goodsReceiptId
├── resourceId
├── quantity
├── unit
├── unitPrice
├── warehouseId
└── warehouseLocationId
```

- One receipt has **exactly one** partner (a **supplier**).
- One receipt has **1..n** lines.
- One line has one resource, a quantity, a measurement unit, a unit price and a
  **warehouse** (required). A specific **warehouse location is optional**.

### Current minimal relationships

```text
Pajamavimas
  → Partneris (Tiekėjas)
  → 1..n eilutės
      → Išteklius
      → Kiekis
      → Matavimo vnt.
      → Vieneto kaina
      → Sandėlis          (required)
      → Sandėlio vieta    (optional)
```

### Physical placement (per line)

Placement is stored **per line**, never only at receipt-header level, because
one receipt may place different lines in different warehouses/locations. See
[warehouses.md](warehouses.md).

- **`Sandėlis` is required** for every line; the warehouse must exist and be
  active for a new receipt.
- **`Vieta` is optional.** When a location is supplied it must exist, be active,
  and belong to the selected warehouse (`warehouseLocation.warehouseId ==
  warehouseId`); a mismatched pair is rejected (the client is never trusted).
  When no location is supplied, the line is valid as long as the warehouse is
  valid and active.
- `Sandėlio vieta` always belongs to exactly one `Sandėlis`.
- Historical receipts remain readable after a warehouse or location is
  deactivated.

## Partner selection

A receipt records goods received **from** a partner, so only:

```text
active partner + SUPPLIER role
```

is selectable. A **buyer-only** partner is not selectable; a
**SUPPLIER + BUYER** partner is. The partner relation is stored by id; supplier
data is never duplicated into the receipt.

## Resource selection

Only **active** resources are selectable for a new receipt. Historical receipts
remain readable if a referenced resource is later deactivated.

## Measurement units

Fixed set for now (no user-managed administration module):

| Key | Lithuanian |
|---|---|
| `KG` | kg |
| `UNIT` | vnt. |

`KG` is the default. More units (litres, metres, m², m³, …) are added only when
confirmed.

## Quantity and unit price (decimal-safe)

- `quantity` is numeric, **greater than zero**, and supports decimals
  (`1250`, `12.5`, `24`). `UNIT` quantities are not restricted to integers.
- `unitPrice` (**Vieneto kaina**) is the price **per selected measurement unit**
  (e.g. `1.42 €/kg`, `3.50 €/vnt.`).

Both are persisted as PostgreSQL `numeric` (Prisma `Decimal`) and exchanged over
the API as **strings** so business quantities and prices never pass through
JavaScript floating point. Domain **line total** = `quantity × unit price` and
the **receipt total** are derived (not client-supplied).

For this first Lithuanian operational flow, `unitPrice` is implicitly **EUR**
per unit. There is **no** currency management, multi-currency or accounting
functionality, and no currency column is required by the schema.

## Packing form / status (deliberately absent)

- **No packing-form relation** on a receipt line yet (`packingFormId` is not
  added). Packing Form exists as reference data but is not part of this first
  screen.
- **No status/lifecycle** (`DRAFT`/`POSTED`/`CONFIRMED`/`CANCELLED`). The first
  version is simply a saved record; lifecycle is designed when its operational
  meaning is understood.

## Save semantics

- Creating a receipt writes the receipt and all its lines **atomically** in one
  transaction; if any line fails, no partial receipt remains.
- Saving does **not** touch stock and does **not** trigger printing/approval.
- After a successful save the UI shows `Pajamavimas išsaugotas.` and the new
  record appears in the list.

## Authorization

Reuses the existing authentication/authorization infrastructure — no new role
or permission framework.

| Capability | Endpoint | Requirement |
|---|---|---|
| List receipts | `GET /receipts` | authenticated |
| Receipt details | `GET /receipts/:id` | authenticated |
| Create receipt | `POST /receipts` | authenticated |

Creation is **not** ADMIN-only; this is expected to become an operational
warehouse workflow. There is no `PATCH`/`DELETE` yet.

### Server-side validation (authoritative)

The API verifies (never trusting UI dropdown filtering):

- the partner exists, is active, and has the `SUPPLIER` role;
- every referenced resource exists and is active;
- every line's warehouse exists and is active;
- each line's location, **when supplied**, exists, is active and belongs to the
  selected warehouse.

Errors are clear and do not leak Prisma internals.

## API, contracts and UI

- API module: `apps/api/src/modules/receipts/` (controller, service, mapper,
  module).
- Shared contracts: `@aitvaras/contracts` (`receipts.ts`) — strict schemas
  (unknown fields rejected), decimal strings, ≥1 line, quantity > 0,
  unit price ≥ 0, fixed units and centralised Lithuanian labels.
- List is newest-first. No filters/search/pagination.
- UI routes (inside the shell): `/receipts` (create form + recent receipts) and
  `/receipts/[id]` (read-only detail). Navigation item: `Pajamavimas`
  (authenticated), between `Sandėliai` and `Naudotojai`.
- Each line selects `Išteklius`, `Kiekis`, `Matavimo vnt.`, `Vieneto kaina`,
  `Sandėlis *` (required) and `Vieta` (optional). The `Vieta` selector lists
  only the active locations of the selected warehouse, is disabled until a
  warehouse is chosen, and offers `— Be konkrečios vietos —` so a line can be
  saved without a specific location; changing the warehouse clears the location.
  UI is Lithuanian and responsive: the line uses a two-row layout
  (resource/quantity/unit/price, then warehouse/location) and stacks on narrow
  screens. The detail view shows the warehouse and the location (or `—` when no
  specific location was recorded).

## Referential behaviour

Receipts reference `Partner` and `Resource` by id. Partner/Resource are
**deactivated, never deleted**, and foreign keys **restrict** deletion, so
historical receipts keep valid references. There is no receipt delete endpoint.

## Related documents

- [scope.md](scope.md) — confirmed scope
- [partners.md](partners.md) — suppliers (Tiekėjas)
- [resources.md](resources.md) — resources and measurement context
- [warehouses.md](warehouses.md) — warehouses and locations (placement)
- [domain-glossary.md](domain-glossary.md) — terminology
- [backend-architecture.md](backend-architecture.md) — module rules
