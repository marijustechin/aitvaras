# Domain Glossary (Aitvaras)

> Status: lightweight, **confirmed terminology only**. This file records
> confirmed business vocabulary so it is used consistently in code, UI and
> documentation. It reflects what is implemented; see [scope.md](scope.md).

Do not add speculative or legacy-derived vocabulary.

## Partneris (partner)

A business counterparty. One unified concept — **not** split into separate
supplier/buyer entities. A partner may be one or both of:

| Role key | Lithuanian |
|---|---|
| `SUPPLIER` | Tiekėjas |
| `BUYER` | Pirkėjas |

Partner roles are independent of system **access roles** (`ADMIN`,
`WAREHOUSE_WORKER`, `ACCOUNTING`, `PRODUCTION_MANAGER`).

**Status: implemented** (`docs/partners.md`).

## Išteklius (resource)

A business item/material/product handled by Aitvaras. Has exactly one category,
a required name, optional notes, and an active/inactive lifecycle.

**Status: implemented** (`docs/resources.md`).

## Išteklių kategorija (resource category)

**Administrator-managed master data** — not a closed enum. A resource has exactly
one category. Categories have a unique name and an active/inactive lifecycle;
they are deactivated, never hard-deleted.

The three historical values are **seeded default records**, not the complete set:

| Default category |
|---|
| Žaliava |
| Pusgaminis |
| Gaminys |

Inactive categories remain valid for existing resources but cannot be selected for
new ones (or reassigned to another resource). Categories **classify** resources;
they do **not** encode the production lifecycle (no implicit
`Žaliava -> Pusgaminis -> Gaminys` state machine) and do **not** provide
provenance. **Status: implemented** (`docs/resources.md`); the surrounding
inventory/production principles are confirmed future direction, not implemented —
see [scope.md](scope.md).

## Pakavimo forma (packing form)

How goods are physically packed/presented for handling/storage. **Independent
reference/master data** — deliberately **not** a permanent property of a
resource (a later delivery may use a different form). Confirmed initial forms:

```text
Dėžė
Maišas
Metalinis narvas
Rulonas
```

**Status: implemented** as reference data with an explicit idempotent seed
(`pnpm seed:reference`); see `docs/resources.md`. Packing forms are **not yet**
linked to resources or receipt lines.

## Pajamavimas (goods receipt)

The physical receipt of resources from a **supplier** (Tiekėjas) partner. One
receipt has exactly one supplier and **1..n lines**; each line has an
`Išteklius`, `Kiekis`, `Matavimo vnt.` (`kg` / `vnt.`), `Vieneto kaina`, a
required `Sandėlis` and an optional `Sandėlio vieta`. It is **not** an accounting
purchase, supplier invoice, payment, stock ledger or warehouse balance, and
saving does not create stock. Denominations: `Pajamavimas`, `Pajamavimai`.

**Status: implemented (first minimal iteration)** (`docs/receipts.md`).

## Partija (batch / lot)

A receiving **batch/lot**: one physical delivery of **one** resource from **one**
supplier (Tiekėjas) into **one** warehouse (`Sandėlis`), registered bag by bag and
initially `PENDING` (Laukiama patvirtinimo). A batch has a unique, human-readable,
system-generated `Kodas` (`P-<year>-<sequence>`) and an `arrivalDate` (physical
arrival, independent of creation time). It exists independently of the
`Pajamavimas` and may later be reconciled with one **without duplicating
quantities**. A batch is **not** stock.

**Status: implemented (first iteration)** (`docs/batches.md`).

## Maišas (bag / handling unit)

One physical **bag/handling unit** inside exactly one `Partija`. Incoming material
arrives as many bags of one batch, and bags of the same batch may have **different
measured weights** (`Svoris`). Each bag has a unique `Brūkšninis kodas` and an
optional `Sandėlio vieta` (which must belong to the batch's warehouse). Bags are
not deleted and are added only while the batch is `PENDING`.

**Status: implemented (first iteration)** (`docs/batches.md`).

## Brūkšninis kodas (bag barcode)

The unique identifier of a **physical bag/handling unit** (13-digit, EAN-13-shaped,
GS1 `20` restricted-circulation prefix). It identifies the physical unit only and
**encodes no business data** (no supplier, resource, date, batch or cost) — the
relationships provide that. It is not the resource type or the batch.

**Status: implemented (first iteration)** (`docs/batches.md`).

## Sandėlis (warehouse)

A physical warehouse. A warehouse has **1..n** locations. Deactivated, never
hard-deleted; only a name and active flag are confirmed.

**Status: implemented** (`docs/warehouses.md`).

## Sandėlio vieta (warehouse location)

A physical location inside **exactly one** warehouse (e.g. `Stelažas A1`,
`Lentyna B2`, `Stalas 3`). Names are unique per warehouse, not globally.
Deactivated, never hard-deleted.

**Status: implemented** (`docs/warehouses.md`). Used as the placement of a
goods-receipt line and, optionally, of a `Maišas` (bag).

## Not yet implemented

The following are **not** built and must not be treated as implemented:
purchasing/accounting, supplier invoices, payments, stock balances, warehouse
movements, quantities on hand, production (and production lineage), order/dispatch,
sales, batch/output-lot costing, reporting.

Bag/handling-unit identity and barcodes are implemented **for incoming batches
only**; scan-driven warehouse movements, the batch↔receipt link, confirmation/
reconciliation and a printed barcode graphic remain open (`docs/batches.md`).

## Language conventions

- User-facing text is **Lithuanian**; code/API/database identifiers are
  **English**.
- User-facing terms follow the terminology rule in `AGENTS.md` (Role → Vaidmuo,
  Roles → Vaidmenys, Status → Būsena, Statuses → Būsenos).

## Related documents

- [scope.md](scope.md) — confirmed scope
- [partners.md](partners.md) — the partner module
- [resources.md](resources.md) — resources, categories and packing forms
- [receipts.md](receipts.md) — goods receipts (Pajamavimas)
- [batches.md](batches.md) — batches (Partijos) and bags (Maišai)
- [warehouses.md](warehouses.md) — warehouses and locations
- [legacy-as-reference.md](legacy-as-reference.md) — reference, not blueprint
