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

## Gavimai (received batches)

The ADMIN administrative queue of physical receiving records created through
`Registruoti sandėlyje`. It is a review/history and work-queue view (filter by
status / supplier / resource / warehouse / arrival date / batch code; default
`Reikia patvirtinti` = the not-yet-confirmed `PENDING` batches) whose rows open the batch's
formal **reconciliation**, with the human-facing `Gavimas` code shown as the
grouping reference. The default pending queue is **not date-bounded** (the
`Priėmimo data` filters are empty by default) so old pending items are never
silently hidden. `Gavimai` replaced the former top-level `Pajamavimas` label;
it is **not** a place to create receiving records (that is the warehouse worker's
task).

**Status: implemented** (`docs/batches.md`).

## Gavimas (incoming delivery)

One physical incoming **arrival**: the goods of **one** supplier on **one**
arrival date, registered by a warehouse worker. It is the **user-facing receiving
unit** (container) and carries the **main human-facing receipt identifier**, the
code `G<YY><MM>-<NN>` (e.g. `G2609-01`, month-sequenced, unique, encodes no
business data). One `Gavimas` may
contain **several resources**, and different resources from the same delivery may
go to **different warehouses** (the warehouse belongs to the batch, not the
delivery). A `Gavimas` is **not** the formal `Pajamavimas` and is **not** stock.
The **vehicle/truck is outside system scope** and is not modelled. Denominations:
`Gavimas`, `Gavimai`.

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

An **internal** grouping inside one `Gavimas`: exactly **one** resource
(`Išteklius`) into **one** warehouse (`Sandėlis`), registered package by package
and initially `PENDING` (Laukiama patvirtinimo). A delivery may contain several
batches; the same resource into different warehouses is different batches. A batch
has a compact, system-generated `Kodas` (`P<NN>`, e.g. `P01`) that is **local to
its delivery** (reset per delivery, max `P99`) and **secondary** to the
human-facing delivery code. It is created independently of
the `Pajamavimas` and later **reconciled** with a formal receipt line **without
duplicating quantities**, optionally storing a documentary piece count. A batch is
**not** stock.

**Status: implemented** (`docs/batches.md`).

## Pakuotė (package / handling unit)

The **user-facing** term is **`Pakuotė`** (plural `Pakuotės`; a package — bag, box,
pallet, other); `Maišas` was too bag-specific. `Tara` is **not** the physical
instance — it is the packaging **type/master data** (see below). The internal
model/API/module name remains `Bag`.
One physical package sits inside exactly one `Partija`. Physical receiving is
**always by actual weight**: every package references one `Tara` and stores
`Bruto svoris` (gross, the value entered) plus the snapshotted tare and `Neto
svoris` (`netWeight = grossWeight − tare snapshot`, computed server-side); there is
**no KG/PCS unit selector** and no count-based physical receiving. The `Sandėlio
vieta` is **required** (and must belong to the batch's warehouse; it may differ per
package). Each package has a unique, opaque `Brūkšninis kodas`; the next package's
packaging type and location are suggested from the batch's latest **active**
package. Packages are **not deleted**: they are added or corrected while the batch
is `PENDING`, and an erroneous one is **voided** (`Anuliuota`) rather than removed.
Measured totals use **net** weight.

**Status: implemented** (`docs/batches.md`).

## Tara (packaging / tare type)

**The canonical physical-packaging master data** (`PackagingType`). The former,
overlapping `Pakavimo forma` (`PackingForm`) concept was removed (ATV-049);
`Tara` now covers both the physical package type and its tare. A name and a precise
`tareWeightKg` (Decimal 14,3 — never floating point), with an active flag, e.g.
`Maišas` (`0.800 kg`) or `EPAL` (`27.000 kg`). Each handling unit references one;
the tare is subtracted from the entered gross weight to derive the net weight. A
`Tara` is deactivated, never hard-deleted, so historical packages keep valid
references. Denominations: `Tara`.

**Status: implemented** (`docs/packaging-types.md`).

## Dokumentiniai vienetai (documentary piece count)

An optional positive whole-number piece count (`Batch.documentPieces`) recorded
during ADMIN confirmation. It is **additional documentary/business information**
(e.g. "500 pieces") and is **not** a physical receiving unit: it does not replace
the document weight, does not replace the measured physical weight and does not
drive any package or batch total.

**Status: implemented** (`docs/batches.md`).

## Anuliuota pakuotė / Pataisymas (voided package / correction)

A physical package is **never hard-deleted**. While the batch is not `CONFIRMED`,
a warehouse worker may **correct** an active package (its `Tara`, `Bruto svoris`
and/or `Sandėlio vieta`) or **void** it (`Anuliuoti`) with an optional reason. A
voided (`Anuliuota`) package keeps its barcode and history but is excluded from the
batch's measured weight and active count; each effective change is appended to an
auditable **correction trail** (`Pataisymų istorija`: kind, package barcode,
previous/new value, reason, who, when). A documentary mismatch is recorded
separately in `Gavimo neatitikimas` and does not keep the batch open.

**Status: implemented** (`docs/batches.md`).

## Registruoti sandėlyje (physical warehouse receiving)

The warehouse worker's operational action: the **physical** receiving step —
starting a `Partija`, registering individual `Pakuotės` with measured weights and
printing package labels. It is deliberately **not** the formal `Pajamavimas`
documentary flow: documentary weight, acquisition value, document number/date and
reconciliation are administrative and belong to `ADMIN`. Use the term
`Registruoti sandėlyje`; do not use `Perkelti į gamybą` (production transfer is
out of scope).

**Status: implemented** (`docs/batches.md`).

## Pajamavimo patvirtinimas (batch reconciliation)

The formal/documentary confirmation that links a physical `Partija` to a
`Pajamavimas` (GoodsReceipt) line. A warehouse worker records the physical truth
(packages and measured net weights); the confirmation (by `ADMIN`/Eimantas) records
the **accepted documentary weight** (`Dokumentinis svoris`), an optional
**`Dokumentiniai vienetai`** piece count and the **initial acquisition value**, and
confirms the batch. It creates no packages or stock: the **packages are the
physical quantity source**, the receipt is the documentary/financial record. An
exact match confirms directly; a **mismatch does not block confirmation** — it also
confirms (with an explicit acknowledgement) and records a separate
`Gavimo neatitikimas` (discrepancy). The signed difference is
`measuredWeight − documentWeight`. Everything is weight-based; the piece count is
documentary only.

**Status: implemented** (`docs/batches.md#reconciliation-formal-confirmation`).

## Gavimo neatitikimas (receiving discrepancy)

A long-lived record created when a `Partija` is **confirmed** with a non-zero
`measuredWeight − documentWeight`. Fields: batch (unique), supplier, measured /
document / difference weights (signed), `status` (`OPEN` | `PARTIALLY_SETTLED` |
`SETTLED`), creator, `createdAt`, `settledAt?`. The signed difference is immutable;
negative is a `Trūkumas` (shortage), positive a `Perteklius` (overage). It is
**separate** from the confirmation lifecycle: the batch is already `CONFIRMED`, the
physical stock stays the measured net weight, and the discrepancy may stay open for
a long time. It is settled through the append-only **`DiscrepancySettlement`**
ledger — `WEIGHT` (optional link to the later confirmed same-supplier batch; no
stock is added) or `MONEY` (a money/credit amount; **no money↔weight conversion**).
Each entry's `coveredWeightKg` is always positive and reduces the remaining
magnitude; the status moves `OPEN → PARTIALLY_SETTLED → SETTLED`.

**Status: implemented** (`docs/discrepancies.md`).

## Brūkšninis kodas (bag barcode)

The unique identifier of a **physical package** (13-digit, EAN-13-shaped, GS1 `20`
restricted-circulation prefix), rendered as a scannable EAN-13 graphic on the
label. It identifies the physical package only and **encodes no business data**
(no supplier, delivery, resource, date, batch or cost) — the relationships provide
that. The label also carries human-readable metadata (delivery code, warehouse,
location, category, resource and actual weight); none of it is encoded into the
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
goods-receipt line and of a physical `Pakuotė`.

## Not yet implemented

The following are **not** built and must not be treated as implemented:
purchasing/accounting, supplier invoices, payments, stock balances, warehouse
movements, quantities on hand, production (and production lineage), order/dispatch,
sales, batch/output-lot costing, reporting.

Package/`Pakuotė` identity, barcodes, GoodsReceipt **reconciliation** and
auditable package **correction/void** are implemented **for incoming batches only**;
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
- [resources.md](resources.md) — resources and categories
- [receipts.md](receipts.md) — goods receipts (Pajamavimas)
- [batches.md](batches.md) — batches (Partijos) and packages (Pakuotės)
- [warehouses.md](warehouses.md) — warehouses and locations
- [legacy-as-reference.md](legacy-as-reference.md) — reference, not blueprint
