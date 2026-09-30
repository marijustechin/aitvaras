# Batches and Bags (Partijos ir maišai)

> Status: **implemented** — bag-by-bag receiving (ATV-029), formal GoodsReceipt
> reconciliation (ATV-030) and physical handling-unit correction/void (ATV-041).
> Incoming **batch/lot** registration with individual physical **bags/handling
> units**, a unique barcode, documentary confirmation and an auditable correction
> trail. This is a slice of the confirmed inventory/production direction (see
> [scope.md](scope.md)); it deliberately does **not** implement stock balances,
> movements, production lineage or costing.

## What a Partija is (and is not)

A **Partija** (batch/lot) records one physical delivery of **one** resource from
**one** supplier into **one** warehouse. It is created at the start of bag-by-bag
registration and stays **`PENDING`** until a responsible person (Eimantas)
formally confirms it against a `Pajamavimas` (GoodsReceipt).

Warehouse workers record the **physical truth** (individual bags and their
measured weights); the formal/documentary **confirmation** records the accepted
documentary weight, acquisition value and the link to the formal document. The
formal GoodsReceipt is reconciled with the batch **without duplicating
quantities**: the bags are the physical quantity source, the receipt is the
documentary/financial record, and the two are joined by
`Batch.receiptLineId` (see "Reconciliation").

A Partija is **not** stock: creating a batch, a bag or a reconciliation does
**not** change any balance, and there is no quantity-on-hand anywhere in the
system.

## What a Maišas (bag / handling unit) is

A **Maišas** is one physical handling unit inside exactly one batch. Incoming raw
material usually arrives as many bags of one batch, and **bags of the same batch
may have different quantities**.

A unit's quantity is measured in one of two units: **`KG`** (weight; positive
decimal, 3-decimal precision) or **`PCS`** (count; positive whole units — a
fractional count is rejected, never silently rounded). The default is `KG`. A
batch uses a **single** unit: the first registered unit establishes it and every
later unit must match, so a batch never mixes kilograms and pieces.

Every unit is **placed in a warehouse location** that belongs to the batch's
warehouse; the location is required.

Each bag receives its own **unique barcode** (`Brūkšninis kodas`), rendered as a
scannable EAN-13 graphic on the label. The barcode identifies the **physical unit
only** and encodes **no business data** (no supplier, resource, date, batch or
cost) — the relationships provide the meaning. Bags are **never deleted**: a
corrigible unit is corrected or voided (see "Physical correction and voiding"),
and there is no delete endpoint.

When registering the next unit of a batch, the form **preselects the location of
the most recently registered unit** (`suggestedLocationId`, derived from the
persisted data, so it survives refreshes and works across workstations); the
worker may still change it. With no previous unit, no location is preselected
(there is no arbitrary fallback).

## Domain model

```text
Batch
├── id
├── code                (unique, human-readable, system-generated)
├── resourceId          (Išteklius)
├── supplierId          (Tiekėjas — active SUPPLIER partner)
├── warehouseId         (Sandėlis)
├── arrivalDate         (physical arrival; independent of createdAt)
├── status              PENDING | CONFIRMED | DISCREPANCY  (default PENDING)
├── receiptLineId       (nullable, unique — formal GoodsReceipt line link)
├── documentWeight      Decimal(14,3)? — accepted documentary weight
├── acquisitionAmount   Decimal(14,2)? — accepted acquisition value (EUR)
├── confirmedAt         (set only on a clean CONFIRMED result)
├── createdById
├── createdAt / updatedAt
└── bags[]              (derived totals only — not stored)

Bag (handling unit)
├── id
├── barcode             (unique; opaque physical-unit identifier)
├── batchId
├── quantity            Decimal(14,3); positive; measured per unit
├── unit                KG | PCS (default KG; one unit per batch)
├── status              ACTIVE | VOIDED (default ACTIVE; never deleted)
├── warehouseLocationId (required; must belong to the batch's warehouse)
├── voidedById          nullable — who voided the unit
├── voidedAt            nullable — when it was voided
├── voidReason          nullable varchar(500) — optional free-text reason
├── createdById
└── createdAt / updatedAt

BagCorrection (append-only audit trail)
├── id
├── bagId
├── kind                QUANTITY | LOCATION | VOID
├── previousValue       nullable varchar(255) — e.g. old quantity / location name
├── newValue            nullable varchar(255) — e.g. new quantity / location name
├── reason              nullable varchar(500)
├── createdById
└── createdAt
```

Derived values shown in the API/UI (never stored, never client-supplied):

- `bagCount` — number of **active** units in the batch (voided units are excluded);
- `unit` — the batch's measurement unit, from its first unit (`null` until then);
- `totalQuantity` — sum of **active** unit quantities (the **measured** total),
  serialised as a **decimal string**; voided units are excluded;
- `difference` — `documentWeight − totalQuantity` for a reconciled batch (same
  precision; a signed decimal string), or `null` before reconciliation;
- `suggestedLocationId` — the location of the most recent unit (batch detail
  only), used to preselect the next unit's location.

Quantities are persisted as PostgreSQL `numeric` (Prisma `Decimal`) and exchanged
as **strings**, so they never pass through JavaScript floating point. The
documentary weight is **never** written over the measured quantity.

## Batch code and bag barcode

- **Batch code** — `P-<year>-<6-digit sequence>`, e.g. `P-2026-000042`.
  Generated by the API (sequential per calendar year), unique via a database
  constraint with retry on conflict. Human-readable for labels and reports.
- **Bag barcode** — a 13-digit, **EAN-13-shaped** code (GS1 `20` restricted-
  circulation prefix + 10 random digits + a valid check digit). Generated by the
  API, unique via a database constraint with retry on conflict. It encodes no
  business data and is **not** copied to child units (splitting is out of scope).

## Status

| Key | Lithuanian | Meaning |
|---|---|---|
| `PENDING` | Laukiama patvirtinimo | created; bags may still be added |
| `CONFIRMED` | Patvirtinta | reconciled with an exact documentary match (terminal) |
| `DISCREPANCY` | Neatitikimas | reconciled but the documentary weight differs |

New bags may be added, and active units **corrected or voided**, while a batch is
`PENDING` or `DISCREPANCY`; a `CONFIRMED` batch is frozen. Reconciliation moves
the batch to `CONFIRMED` (exact match) or `DISCREPANCY` (any difference). A
`DISCREPANCY` batch is resolved by correcting the **physical** units (the measured
total changes) and/or the **documentary** weight, then reconciling again. A
physical correction does **not** change the batch status by itself — a
`DISCREPANCY` batch stays discrepant until an `ADMIN` re-reconciles it. A
`CONFIRMED` batch is terminal.

## Reconciliation (formal confirmation)

Reconciliation is the documentary/financial act performed later by an
`ADMIN` (Eimantas), after the physical units have been registered. It records the
accepted documentary values and resolves/creates the internal formal-document
anchor **server-side** — the user never selects a `GoodsReceipt` or
`GoodsReceiptLine`. It creates **no** bags and no stock.

- **Relationship:** `GoodsReceipt → GoodsReceiptLine → Batch → Bags`.
  `Batch.receiptLineId` is a nullable, **unique** foreign key, so one receipt line
  reconciles at most one batch and one batch is reconciled to at most one line; a
  receipt may still contain multiple lines/resources/batches. A `PENDING` batch
  may exist with no receipt; a reconciled batch always points to one. The
  relationship is internal plumbing; the client sends only formal data.
- **One measurement unit per batch:** reconciliation is weight-based and applies
  to **`KG`** batches only. A `PCS` batch cannot be weight-reconciled
  (`BATCH_NOT_WEIGHT`); pieces are never summed into kilograms and no mixed-unit
  total is produced.
- **Two separate quantities:** the **measured** weight is always the server-derived
  `SUM(bags.quantity)` over the batch's KG units; the **documentary** weight
  (`documentWeight`) is entered at reconciliation. They are never merged, and
  `difference = documentWeight − measuredWeight` is shown as-is (no tolerance).
- **Acquisition value:** `acquisitionAmount` (EUR) is stored on the batch as its
  **initial acquisition value**. Future production transformations will
  redistribute cost from this lineage, but that is out of scope.
- **Internal anchor resolution (no technical selector):**
  `POST /batches/:id/reconcile` carries only formal data (`documentWeight`,
  `acquisitionAmount`, optional document date/number). The server resolves the
  `GoodsReceiptLine` anchor deterministically:
  1. reuse the line the batch is already linked to (discrepancy retry — no
     duplicate);
  2. reuse an existing compatible, **unlinked** receipt line (same supplier via
     the receipt partner, resource and warehouse);
  3. otherwise create a `GoodsReceipt` with one line from the batch + formal data
     (unit `KG`, quantity = documentary weight, unit price = value ÷ weight).
  A reused line is never mutated; the accepted documentary values live on the
  batch. Retrying never duplicates a receipt or line.
- **Document metadata:** `documentDate`/`documentNumber` live on the `GoodsReceipt`
  (the formal document) and may be supplied at reconciliation when not already set;
  an existing value is never overwritten.

### Reconciliation error codes

`POST /batches/:id/reconcile` returns an explicit `code` in error bodies:

| Code | HTTP | Meaning |
|---|---|---|
| `BATCH_NOT_FOUND` | 404 | unknown batch |
| `BATCH_EMPTY` | 400 | batch has no units |
| `BATCH_NOT_WEIGHT` | 400 | batch unit is `PCS` (not weight-reconcilable) |
| `BATCH_ALREADY_CONFIRMED` | 409 | batch is already `CONFIRMED` |
| `RECEIPT_CREATE_FAILED` | 409 | internal receipt creation failed (unexpected) |

## Physical correction and voiding (worker)

Physical reality is authoritative. A warehouse worker may correct what they
physically measure/place without an ADMIN, while the batch is not yet
`CONFIRMED`:

- **Correct a unit** (`PATCH /batches/:id/bags/:bagId`): change `quantity`
  and/or `warehouseLocationId` on an **active** unit. The payload must contain at
  least one field; the unit must still be `ACTIVE` and the batch not `CONFIRMED`.
  The new location must exist, be active and belong to the batch's warehouse;
  `PCS` quantities must be whole units (`UNIT_MISMATCH`). Only the **changes**
  are recorded, one `BagCorrection` row per changed field (`QUANTITY`,
  `LOCATION`); a no-op request changes nothing and records no trail.
- **Void a unit** (`POST /batches/:id/bags/:bagId/void`): the unit is **never
  deleted**. It is marked `VOIDED` (who/when and an optional reason are stored)
  and excluded from the measured total and active unit count; its barcode and
  history are preserved. A `VOID` row is appended to the trail.

The correction trail (`BatchDetail.corrections`, newest first) records the kind,
the affected unit's barcode, previous/new value, reason, who and when — so a
discrepancy can be understood and audited without a hard delete.

### Correction error codes

| Code | HTTP | Meaning |
|---|---|---|
| `BAG_NOT_FOUND` | 404 | unknown unit within the batch |
| `BATCH_CONFIRMED` | 409 | batch is `CONFIRMED` (frozen) |
| `BAG_VOIDED` | 400 | unit is already `VOIDED` (cannot be corrected again) |

Adding a unit to a `CONFIRMED` batch is rejected with `BATCH_CONFIRMED` (400).

## API, contracts and UI

- API module: `apps/api/src/modules/batches/` (controllers, service, mapper,
  code/barcode generation).
- Shared contracts: `@aitvaras/contracts` (`batches.ts`).

| Capability | Endpoint | Requirement |
|---|---|---|
| List batches (optional `?status=`) | `GET /batches` | authenticated |
| Batch detail (with bags) | `GET /batches/:id` | authenticated |
| Start a batch | `POST /batches` | `ADMIN` or `WAREHOUSE_WORKER` |
| List a batch's bags | `GET /batches/:id/bags` | authenticated |
| Add a bag | `POST /batches/:id/bags` | `ADMIN` or `WAREHOUSE_WORKER` |
| Correct a unit (quantity/location) | `PATCH /batches/:id/bags/:bagId` | `ADMIN` or `WAREHOUSE_WORKER` |
| Void a unit (audited, never deleted) | `POST /batches/:id/bags/:bagId/void` | `ADMIN` or `WAREHOUSE_WORKER` |
| Look up a bag by barcode | `GET /bags/by-barcode/:barcode` | authenticated |
| Reconcile (formal confirmation) | `POST /batches/:id/reconcile` | `ADMIN` |

- UI routes (inside the shell): **`Gavimai`** (`/receipts`) is the ADMIN
  received-batch **queue** (status / supplier / resource / warehouse /
  arrival-date / code filters; default `Reikia patvirtinti` = `PENDING` +
  `DISCREPANCY`) and `/receipts/batches/[id]` is the **ADMIN review** screen
  (batch context, read-only unit list, label preview/print, formal reconciliation
  form). Each queue row is itself a **whole-row link** to the detail (keyboard
  focusable, hover/focus feedback, no separate action button). Queue columns:
  `Partija`, `Priėmimo data`, `Tiekėjas`, `Išteklius`, `Sandėlis`,
  `Maišai / kiekis`, `Būsena` — status is neutral for `PENDING`, emerald for
  `CONFIRMED` and rose for `DISCREPANCY` (restrained text colour, not a coloured
  row). The filter panel has an **`Atstatyti filtrus`** action that clears every
  filter back to the default `Reikia patvirtinti` view (disabled when no filter is
  active). ADMIN does **not** create batches here; physical bag registration lives
  in the worker `Registruoti sandėlyje` flow. Filtering is client-side over the
  small received-batch dataset.
- The batch detail page shows the batch context and a **read-only** list of the
  registered units (`Barkodas`, `Vieta`, `Kiekis`, `Mato vnt.`, `Būsena`,
  `Užregistruota`) with an optional label preview/reprint; voided units are shown
  muted with their `Anuliuotas` status and reason. It also shows the
  **`Pataisymų istorija`** (correction history) table. There are **no**
  bag-creation or correction controls here (those are worker actions).
- For a non-confirmed batch, `ADMIN` sees a **reconciliation form** with formal
  data only — `Dokumentinis svoris`, `Įsigijimo vertė`, `Dokumento data`,
  `Dokumento Nr.` — plus the `Faktiškai susverta` / `Dokumentuose` / `Skirtumas`
  summary and the **`Patvirtinti gavimą`** action. There is **no** receipt-line
  selector. A `CONFIRMED` batch shows a read-only summary (document vs measured,
  difference, acquisition value, document reference, confirmation date). The
  detail page's back link returns to the `Gavimai` queue (`/receipts`).
- The unit list offers a **label preview** (warehouse, location, category,
  resource, `Partija`, quantity with unit, and a scannable EAN-13 barcode graphic)
  with a print action (`window.print()`).
- Physical receiving (creating batches and registering units) is shown only to
  `ADMIN`/`WAREHOUSE_WORKER` in the `Registruoti sandėlyje` flow; the server
  remains authoritative regardless of UI visibility.

### Warehouse-worker receiving UI (`Registruoti sandėlyje`)

The warehouse worker's job is the **physical** receiving step only; the formal
`Pajamavimas` process (documentary weight, acquisition value, reconciliation,
discrepancy handling) is administrative and is not part of their flow.

- **Home** (`/`): for a receiving role the home is a focused operational
  workplace whose primary action is the prominent `Registruoti sandėlyje` button;
  other roles keep the generic home.
- **Receiving flow** (`/receiving`, protected by the receiving roles): two entry
  modes — `Nauja partija` (supplier, resource, warehouse, arrival date only) or an
  existing open batch, listed under `Nepatvirtintos partijos` (`PENDING`) and
  `Reikia patikslinti` (`DISCREPANCY`, i.e. a batch needing a physical correction),
  each shown with code, supplier, resource, arrival date, bag count, measured
  weight and status. The underlying status keys are not renamed. After creating or
  selecting a batch,
  supplier/resource/warehouse are **inherited** and not re-entered. Unit
  registration takes only `Vieta` (required), `Vienetas` (`kg`/`vnt`, default
  `kg`) and `Kiekis`. Two save actions are offered, each creating exactly one
  unit: **`Išsaugoti ir spausdinti`** (primary — persists the unit and goes
  **straight to the label surface**, no intermediate detail page, invoking the
  browser print preview) and **`Išsaugoti`** (secondary — persists the unit and
  returns straight to the form). Both keep the batch and the last-used location
  and reset **only the quantity**; closing the label returns to the same form. A
  failed save opens no label and keeps the entered form data. The buttons carry a
  small decorative inline-SVG icon (Save/Printer) alongside their text.
- **Label**: warehouse, location, category, resource, batch code (separate
  human-readable text), quantity with unit (e.g. `48.725 kg` / `12 vnt`), and the
  barcode (value + scannable EAN-13 graphic). The barcode is the only machine
  value and encodes no batch metadata. The label surface keeps a single
  `Spausdinti` fallback action in case automatic printing is blocked. No
  printer-hardware integration.
- **Batch units list:** below the entry form, the selected batch's **active**
  units are listed under `Partijos maišai`, **newest first**, with `Barkodas`,
  `Vieta`, `Kiekis`, `Mato vnt.`, `Užregistruota` and row actions `Taisyti`
  (correct quantity/location), `Anuliuoti` (void) and `Spausdinti` (reprint the
  existing label — creates nothing). Correcting opens an inline editor; voiding
  opens an inline panel with an optional reason. Voided units move to a separate
  `Anuliuoti maišai` list (muted, with who/when/reason) and are excluded from the
  measured total. An empty batch shows a compact `Šioje partijoje dar nėra
  užregistruotų maišų.` state, and the list refreshes immediately after each save,
  correction or void.
- **Navigation**: the worker navigates `Pradžia`, reference lists and
  `Registruoti sandėlyje`; `Pajamavimas` is hidden from the worker's navigation.
  `ADMIN` keeps full access to the formal flow. Server-side authorization is
  unchanged.
- The worker flow **never** shows documentary weight, acquisition amount, document
  number/date or reconciliation controls.

### Server-side validation (authoritative)

The API verifies (never trusting UI filtering):

- the resource exists and is active;
- the supplier exists, is active and holds the `SUPPLIER` role;
- the warehouse exists and is active;
- unit `quantity` > 0; `KG` accepts decimals, `PCS` accepts whole units only;
- a unit's **location is required** and must exist, be active and belong to the
  batch's warehouse (friendly message: `Pasirinkite sandėlio vietą.`);
- a unit's `unit` must match the batch's established unit
  (`UNIT_MISMATCH` otherwise);
- units can be added or corrected **only** while the batch is `PENDING` or
  `DISCREPANCY` (a `CONFIRMED` batch is frozen — `BATCH_CONFIRMED`); a corrected
  unit must be `ACTIVE` (`BAG_VOIDED` otherwise) and its new location must be
  valid for the batch warehouse; `PCS` corrections accept whole units only;
- reconciliation requires a non-empty `KG` batch, a non-`CONFIRMED` batch, a
  compatible receipt line, `documentWeight > 0` and a non-negative acquisition
  amount; the measured total is computed server-side and never trusted from the
  client.

## Referential behaviour

Batches reference `Resource`, `BusinessPartner`, `Warehouse`, `User` and
(optionally) a `GoodsReceiptLine` by id; bags reference `Batch`,
`WarehouseLocation` and `User`, and `BagCorrection` rows reference `Bag` and
`User`. Referenced master data is deactivated, never deleted, and foreign keys
**restrict** deletion, so historical batches/bags keep valid references. There is
no batch/bag delete endpoint — a unit is **voided**, never deleted, and its
correction trail is append-only.

## Open / not implemented

- **Bag split / merge and EAN lineage to child units** — units can now be
  corrected (quantity/location) and voided (ATV-041), but splitting/merging a
  unit and propagating a barcode to child units are not modelled.
- **Post-confirmation corrections** — a `CONFIRMED` batch is frozen; corrections
  after confirmation are not supported. A discrepancy is resolved before
  confirmation (correct physical units and/or the documentary weight, then
  re-reconcile).
- **Non-weight reconciliation** — `PCS` batches have no reconciliation model yet;
  only `KG` batches are weight-reconciled.
- **Tolerance percentages** — exact equality is the only clean-confirmation rule.
- **`Bag`/`Maišas` naming** — the internal model is still called `Bag` even though
  it now generalises to weight- or count-based handling units; renaming it to
  `HandlingUnit` is a deferred, purely mechanical refactor.
- **VAT/accounting engine, cost redistribution, production transformations,
  output lots, order allocation** — confirmed future direction, not modelled here
  (see [scope.md](scope.md)).

## Related documents

- [scope.md](scope.md) — confirmed scope and confirmed future principles
- [receipts.md](receipts.md) — the `Pajamavimas` transactional record
- [resources.md](resources.md), [warehouses.md](warehouses.md) — referenced master data
- [domain-glossary.md](domain-glossary.md) — terminology
- [backend-architecture.md](backend-architecture.md) — module rules
