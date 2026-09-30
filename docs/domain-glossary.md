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

## Gavimai (received batches)

The ADMIN administrative queue of physical receiving batches created through
`Registruoti sandėlyje`. It is a review/history and work-queue view (filter by
status / supplier / resource / warehouse / arrival date / batch code; default
`Reikia patvirtinti` = `PENDING` + `DISCREPANCY`) whose rows open the batch's
formal **reconciliation**. `Gavimai` replaced the former top-level `Pajamavimas`
label; it is **not** a place to create physical batches (that is the warehouse
worker's task).

**Status: implemented** (`docs/batches.md`).

## Pajamavimas (goods receipt)

The physical receipt of resources from a **supplier** (Tiekėjas) partner. One
receipt has exactly one supplier and **1..n lines**; each line has an
`Išteklius`, `Kiekis`, `Matavimo vnt.` (`kg` / `vnt.`), `Vieneto kaina`, a
required `Sandėlis` and an optional `Sandėlio vieta`. It is **not** an accounting
purchase, supplier invoice, payment, stock ledger or warehouse balance, and
saving does not create stock. Denominations: `Pajamavimas`, `Pajamavimai`.

**Status: internal formal-document model** (`docs/receipts.md`). The manual
creation UI was removed: the `GoodsReceipt`/`GoodsReceiptLine` records are
resolved or created **server-side** by batch reconciliation, and the business
label `Pajamavimas` is superseded in the UI by `Gavimai`.

## Partija (batch / lot)

A receiving **batch/lot**: one physical delivery of **one** resource from **one**
supplier (Tiekėjas) into **one** warehouse (`Sandėlis`), registered bag by bag and
initially `PENDING` (Laukiama patvirtinimo). A batch has a unique, human-readable,
system-generated `Kodas` (`P-<year>-<sequence>`) and an `arrivalDate` (physical
arrival, independent of creation time). It is created independently of the
`Pajamavimas` and later **reconciled** with a formal receipt line **without
duplicating quantities**. A batch is **not** stock.

**Status: implemented** (`docs/batches.md`).

## Maišas (bag / handling unit)

One physical **handling unit** inside exactly one `Partija`. A unit carries a
**quantity** measured in one of two units — `KG` (weight, label `kg`) or `PCS`
(count, label `vnt`), default `KG`. A batch uses a **single** unit: the first
registered unit establishes it and every later unit must match. The `Sandėlio
vieta` is **required** (and must belong to the batch's warehouse). Each unit has a
unique, opaque `Brūkšninis kodas`; the next unit's location is suggested from the
most recently registered unit. Units are **not deleted**: they are added or
corrected while the batch is `PENDING` or `DISCREPANCY`, and an erroneous unit is
**voided** (`Anuliuotas`) rather than removed.

**Status: implemented** (`docs/batches.md`).

## Anuliuotas maišas / Pataisymas (voided unit / correction)

A physical unit is **never hard-deleted**. While the batch is not `CONFIRMED`, a
warehouse worker may **correct** an active unit (its `Kiekis` and/or `Sandėlio
vieta`) or **void** it (`Anuliuoti`) with an optional reason. A voided
(`Anuliuotas`) unit keeps its barcode and history but is excluded from the batch's
measured total and active unit count; each effective change is appended to an
auditable **correction trail** (`Pataisymų istorija`: kind, unit barcode,
previous/new value, reason, who, when). Correcting physical units does not by
itself clear a `DISCREPANCY` — an `ADMIN` re-reconciles afterwards.

**Status: implemented** (`docs/batches.md`).

## Registruoti sandėlyje (physical warehouse receiving)

The warehouse worker's operational action: the **physical** receiving step —
starting a `Partija`, registering individual `Maišai` with measured weights and
printing bag labels. It is deliberately **not** the formal `Pajamavimas`
documentary flow: documentary weight, acquisition value, document number/date and
reconciliation are administrative and belong to `ADMIN`. Use the term
`Registruoti sandėlyje`; do not use `Perkelti į gamybą` (production transfer is
out of scope).

**Status: implemented** (`docs/batches.md`).

## Pajamavimo patvirtinimas (batch reconciliation)

The formal/documentary confirmation that links a physical `Partija` to a
`Pajamavimas` (GoodsReceipt) line. A warehouse worker records the physical truth
(bags and measured weights); the confirmation (by `ADMIN`/Eimantas) records the
**accepted documentary weight** (`Dokumentinis svoris`) and **initial acquisition
value**, and compares them with the measured total. It creates no bags or stock:
the **bags are the physical quantity source**, the receipt is the documentary/
financial record. An exact match becomes `CONFIRMED` (Patvirtinta); any difference
becomes `DISCREPANCY` (Neatitikimas) and can be corrected and retried. It is
weight-based and applies to **`KG`** batches only; `PCS` batches are not
weight-reconciled.

**Status: implemented** (`docs/batches.md#reconciliation-formal-confirmation`).

## Brūkšninis kodas (bag barcode)

The unique identifier of a **physical handling unit** (13-digit, EAN-13-shaped,
GS1 `20` restricted-circulation prefix), rendered as a scannable EAN-13 graphic on
the label. It identifies the physical unit only and **encodes no business data**
(no supplier, resource, date, batch or cost) — the relationships provide that. The
label also carries human-readable metadata (warehouse, location, category,
resource, batch code and quantity with unit); none of it is encoded into the
barcode. It is not the resource type or the batch.

**Status: implemented** (`docs/batches.md`).

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

Bag/handling-unit identity, barcodes, GoodsReceipt **reconciliation** and
auditable unit **correction/void** are implemented **for incoming batches only**;
scan-driven warehouse movements, bag split/merge, tolerance handling and cost
redistribution remain open (`docs/batches.md`).

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
