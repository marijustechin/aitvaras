# Aitvaras Scope — Confirmed Requirements Only

> Canonical statement of **what Aitvaras is currently approved to build**.
> Aitvaras proceeds **step by step from confirmed requirements only**. If it is
> not listed as confirmed here, it is not approved work.

## Currently confirmed scope

### Identity and access

The confirmed application functionality starts with **identity and access
management**:

- users with a unique login credential and a hashed password;
- credential-based login (JWT access tokens);
- active/inactive users;
- role-based authorization;
- user administration (admin-only).

### Business partners (Partneriai)

The first confirmed business-domain module is **business partners**:

- one unified partner entity (a counterparty), never separate supplier/buyer
  entities;
- partner business roles `SUPPLIER`/`BUYER` (Tiekėjas/Pirkėjas), multi-valued;
- active/inactive lifecycle (deactivated, not normally deleted).

See [partners.md](partners.md). **Only partners are confirmed**; no other
business module is approved.

### Resources, categories and packing forms

The second confirmed business-domain scope is **resources** plus supporting
master data:

- one resource entity with exactly one category, a required name, optional notes
  and an active/inactive lifecycle;
- **resource categories** as **administrator-managed master data** (`Žaliava`,
  `Pusgaminis`, `Gaminys` are seeded defaults, not the complete set); categories
  are deactivated, never hard-deleted, and inactive ones remain valid for
  existing resources but cannot be selected for new ones;
- **packing forms** (`Dėžė`, `Maišas`, `Metalinis narvas`, `Rulonas`) as
  independent reference data — deliberately **not** a permanent resource
  property.

See [resources.md](resources.md).

### Goods receipts (Pajamavimas)

The third confirmed business-domain scope is the first minimal **goods receipt**
workflow:

- one receipt records the physical receipt of resources from one **supplier**
  partner, with **1..n lines**;
- each line has a resource, a quantity, a measurement unit (`kg`, `vnt.`), a
  unit price, a **required warehouse** and an **optional warehouse location**;
- saving records the receipt transaction only — it does **not** create or modify
  warehouse stock.

See [receipts.md](receipts.md). Each receipt line also records **physical
placement** (warehouse + location) — see the warehouses section below.

### Warehouses and locations (Sandėliai ir vietos)

The confirmed supporting master data for physical placement:

- **Warehouse** (`Sandėlis`) — deactivated, never hard-deleted; only a name and
  active flag are confirmed;
- **WarehouseLocation** (`Sandėlio vieta`) — always belongs to exactly one
  warehouse; names are unique per warehouse, not globally.

See [warehouses.md](warehouses.md).

### Batches and bags (Partijos ir maišai)

The first slice of the confirmed inventory direction: **incoming batch/lot
registration with individual physical bags/handling units**:

- a **Partija** (batch/lot) records one delivery of one resource from one active
  `SUPPLIER` into one warehouse, with an arrival date and a system-generated,
  human-readable, unique code; it starts `PENDING`;
- a **Maišas** (bag/handling unit) is one physical unit of a batch with its own
  measured weight (bags of one batch may differ), an optional warehouse location
  and a unique barcode that identifies the physical unit only and encodes **no**
  business data;
- batches and bags are **not** stock: creating them does not change any balance,
  and batch/bag totals are derived from the bag rows, never stored.

See [batches.md](batches.md). Only `PENDING` is functional; confirmation,
reconciliation, the batch↔receipt link, scan-driven movements, production lineage
and costing are **not** implemented.

**Not** confirmed (still out of scope): purchasing/accounting, supplier
invoices, payments, stock balances, warehouse **movements**, quantities on
hand, production (and production lineage), batch/output-lot costing, orders and
sales.

### Confirmed initial roles

`ADMIN`, `WAREHOUSE_WORKER`, `ACCOUNTING`, `PRODUCTION_MANAGER`.

Roles are configuration, not legacy semantics. They are identified by stable
string keys, never by numeric ids with implicit meaning.

## Confirmed future inventory/production principles (not yet implemented)

These principles are **confirmed domain direction**, recorded before the future
inventory/production work is designed. They are **not** a complete production
design and must not be read as current behaviour. The current implemented scope
is listed above. **Principle 2 and 3 have a first implemented slice** (incoming
batch/lot + per-bag handling-unit identity, ATV-029 / [batches.md](batches.md));
the rest remain unbuilt.

1. **Resource category is classification only.** `ResourceCategory` is managed
   master data used to classify resources; it must **not** encode or drive the
   production lifecycle. `Žaliava`, `Pusgaminis`, `Gaminys`, `Atliekos` (etc.) are
   categories, not state-machine transitions. The system must not assume a fixed
   `Žaliava -> Pusgaminis -> Gaminys` lifecycle, because one production operation
   may generate several different outputs at once.
2. **Batch/lot identity is separate from resource category.** A purchase/receipt
   creates a traceable batch/lot capturing provenance — source supplier,
   receipt/purchase origin, receipt date, original quantity, acquisition cost and
   a unique batch/lot number. The batch/lot number must remain traceable through
   downstream movements and transformations. Category does **not** provide
   provenance. *First slice implemented (ATV-029): batch/lot with supplier,
   warehouse, arrival date and a unique code — but the receipt origin link,
   original quantity and acquisition cost are not modelled yet.*
3. **Individual physical bags/handling units.** Incoming raw material may arrive
   as many physical bags belonging to the same batch; bags of the same batch may
   have different actual weights. Each physical bag receives its own unique
   EAN/handling-unit identifier and links back to the originating batch/lot. The
   EAN identifies the physical handling unit, **not** the resource type or the
   batch. Warehouse movement is expected to be scan-driven by EAN:
   `Receipt -> Batch -> Bag/EAN -> Warehouse location -> Production`. *First
   slice implemented (ATV-029): per-bag handling units of a batch with measured
   weights, optional location and a unique EAN-shaped barcode; scan-driven
   movement and the movement chain itself are not implemented.*
4. **Production transformations preserve lineage.** A production operation may
   consume one or more input bags/lots and create multiple outputs (semi-finished
   material, finished product, reusable waste/scrap, material written off).
   Lineage must be preserved so a downstream output can ultimately be traced back
   to its originating purchase batch(es). When outputs from multiple source
   batches are combined later, provenance becomes **many-to-many** — do not model
   it as a single mutable `batchId`.
5. **Cost belongs to inventory lineage, not only `Resource`.** The same resource
   can have different actual costs depending on source batch, purchase price,
   production transformation, output allocation and write-off/loss. Actual
   acquisition/production cost must ultimately be tracked at the
   batch/output-lot level rather than only as a static `Resource` property, and
   historical cost allocation through transformations must be reconstructable so
   reports can show how value moved. **The exact cost-allocation rule is not
   decided and must not be invented**; it may require business confirmation.
6. **Order is not Resource.** `Resource`/output lot = physical inventory/product;
   `Order` = commercial/business demand. A final order may reserve or consume
   finished output lots, but the order itself must not implicitly become a
   resource/category. If physical consolidation later creates a new inventory
   unit, model it explicitly rather than conflating `Order` and `Resource`.

## Not in scope (unconfirmed)

The following are **discovery concepts only** and are **not approved**. They
must not be implemented, planned into a roadmap, or assumed from the fact that
a similar concept exists in `/sandelys`:

stock, purchasing, orders, order lines, dispatch, sales, warehouse movements
(including scan-driven movement), quantities on hand, production, production
lineage, batch/output-lot costing, reporting, Sandėlys adapter/integration, data
migration, synchronisation, tenant/company architecture, machine integration.

If any of these are ever approved, it happens through a **new confirmed
requirement** and a recorded task/decision — not by inheriting discovery.

## Discovery documents are not a roadmap

The following documents are **discovery artifacts**. They remain useful
evidence, but they are **not approved work** and must not be read as a plan:

| Document | Status |
|---|---|
| `legacy-domain-map.md` | discovery only |
| `legacy-workflows.md` | discovery only |
| `data-ownership.md` | discovery / decision-preparation; **no ownership decided** |
| `transition-model.md` | proposed rules; **no transition approved** |
| `business-decisions.md` | open questionnaire; **unanswered** |
| `first-slice-readiness.md` | candidate slices; **none selected or approved** |
| `integration-boundaries.md` | boundary principle; **no integration approved** |
| `identity-strategy.md` | design proposal; **not implemented** |
| `project-context.md` | background facts/assumptions |
| `architecture.md` "Candidate modules" | candidate list; **not approved structure** |

Candidate modules, first slices, ownership matrices and integration paths must
be treated as **discovery evidence**, clearly marked **unconfirmed** or
**deferred**. They are not promoted into `TODO.md` as current or next work.

## Rules

1. **Step-by-step only.** Aitvaras builds only confirmed requirements; each is a
   scoped task with verification.
2. **No concept is approved because `/sandelys` has it.** Legacy is a
   [reference, not a blueprint](legacy-as-reference.md) (ADR-004).
3. **Do not infer.** Unknown requirements are recorded as questions, not
   implemented.
4. **Scope changes are explicit.** Adding functional scope requires a confirmed
   requirement plus a task/ADRs, recorded in `TODO.md` and the task journal.

## Related documents

- `authentication.md`, `authorization.md` — the implemented identity/access scope
- `partners.md`, `resources.md`, `receipts.md`, `warehouses.md`, `batches.md`,
  `domain-glossary.md` — implemented business modules and confirmed terms
- `legacy-as-reference.md`, `architecture.md`, `TODO.md`
- Workspace ADR-004 (reference, not blueprint)
