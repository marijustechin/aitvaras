# Legacy Domain Map — `/sandelys`

> **Status: discovery only — NOT an approved roadmap.** See `scope.md`. The
> concepts below are legacy evidence, not committed Aitvaras scope.

> Evidence-based inventory of the legacy warehouse domain, for designing the
> Aitvaras ↔ Sandėlys boundary. Compiled 2026-09-18 from `/sandelys` source at
> branch `alfasis-next` (based on `master` `5b4c639`).
>
> **Observed** = read directly from schema/migrations/models/controllers/seeds.
> **Inferred** = reasoned from code but not confirmed with users/data.
> **Unknown** = requires business confirmation or data inspection.
>
> This is a map of **business meaning and integration relevance**, not a
> column-by-column audit. Legacy is a source of domain knowledge, never the
> Aitvaras specification (ADR-001).

## 1. Schema overview

Core tables created by migrations in `database/migrations/`:

| Table | Purpose |
|-------|---------|
| `stocks` | Physical lot/parcel moving through the warehouse |
| `stock_logs` | Explicit, append-only movement/change history per stock |
| `stock_statuses` | Stock lifecycle statuses (seeded 1–6) |
| `stock_types` | Goods types (raw/semi/product), tied to category + container |
| `stock_categories` | 3 seeded categories |
| `places` | Warehouse/sorting/packing places |
| `place_types` | 3 seeded place types |
| `place_groups` | Operational workstation groups (seeded 1–6) |
| `place_stock_types` | Which stock types are allowed at a place |
| `locations` | Storage positions inside a warehouse place |
| `containers` | Packaging types with tare weight (seeded) |
| `suppliers`, `buyers` | Partners, each linked to a `country` |
| `countries` | Seeded country list (ids look like ISO 3166 numeric codes) |
| `orders` | Buyer orders with expected types/weights/prices |
| `order_statuses` | Order statuses (seeded 1–3) |
| `order_stock_types` | Order line: stock type + weight needed + price |
| `sales` | Dispatch of a stock to a buyer (`atkrovimas`) |
| `stock_errors` | Sorting/packing weight discrepancy records |
| `users`, `roles` | Users with a single role; soft-deletable |
| `audits` | Generic model-change audit trail (Laravel Auditing) |
| `threads`, `messages`, `participants` | Vendored messenger package tables |

### Identifier style and hardcoded assumptions (critical)

- **Everything uses per-database auto-increment integer ids.** There is no
  globally unique identifier anywhere.
- Business meaning is bound to **seeded numeric ids**:
  - `stock_statuses` 1–6; `stock_categories` 1–3; `place_types` 1–3;
    `roles` 1–6; `order_statuses` 1–3; `containers` 1–2.
  - `suppliers.id = 1` is the hardcoded default supplier `(iš vidaus)`
    (used explicitly in `StockController::store`).
  - `User::$accountant_places = [40]` is a hardcoded place id. Place `40` is
    **not** in `PlaceSeeder` (only 1–5 are), so it is a production-created place
    referenced by code. **Inferred**; needs confirmation.
- Role checks are literal role-id comparisons (`app/User.php`):
  `isAdmin` = 1 or 6; `isSuperAdmin`/owner-ish = 1; `isWarehouseWorker` = 2;
  `isManufacturingWorker` = 3; `isReadOnly` = 4; `isAccountant` = 5.
  `canSeePrices` = 1 or 4.
- Money is stored as **integer cents** (`price * 100`), EUR assumed
  (`StockType`, `OrderStockType` accessors; `config/app.php` currency EUR).
- Weight is `decimal(10,3)`; pieces is `integer` (sometimes used as `1` when a
  lot is conceptually "one bag/box").

## 2. Core concepts

### Stock (`stocks`)

- **Identifiers:** `id` (PK, per-instance auto-increment); `barcode`
  (11-char numeric string, **nullable, indexed, NOT unique**).
- **Relationships:** `status_id`→stock_statuses; `place_id`→places;
  `supplier_id`→suppliers; `location_id`→locations (nullable);
  `type_id`→stock_types; `parent_id`→stocks (self-referential lineage);
  `user_id`→users (last actor); `order_id`→orders (nullable).
- **Important fields:** `weight` (decimal 10,3), `pieces` (int),
  `created_at`, `updated_at`.
- **Lifecycle:** driven entirely by `status_id` (see §3). The `stocks` row is
  **mutable** (place, status, weight, pieces, order_id change over time).
- **History:** via `stock_logs` (explicit) and `audits` (generic Eloquent
  change log). **No soft delete**: `stocks` has no `deleted_at` column, and
  `Stock` imports `SoftDeletes` but **does not use the trait**
  (`app/Stock.php`). Deletes are hard (`$stock->delete()`), and the destructive
  `sandelys:dalete-data` command uses `forceDelete()`.
- **Special behaviours:**
  - `Stock::setWeightAttribute` normalises comma decimals.
  - Parent/children model partial splits and manufacturing outputs; a barcode
    can therefore match multiple rows (a lineage), not a single stock.
  - `scopeForUser`/`scopeForUserReport` restrict visibility by role and
    `accountant_places`.
  - `scopeWithoutSales` excludes status 6.
- **Barcode rules (observed in `StockController::makeBarcode`):**
  `barcode = <11-char prefix from date('y') + zero-padded day-of-year>`
  with the trailing character(s) replaced by the stock `id`, e.g. an id is
  embedded so barcodes are roughly `YYDDD` + zero padding + `id`. Barcodes are
  generated on first save for warehouse stock; **no barcode is generated for
  stock created inside manufacturing** (commented out). Barcode uniqueness is
  **not enforced**; duplicates are expected and handled in code.
- **Aitvaras need:** **yes, core.** Any inventory view must understand stock,
  its lifecycle, and its barcode lineage. Whether Aitvaras owns new stock from
  day one is a business decision.

### StockLog (`stock_logs`)

- **Identifiers:** `id` (PK); `stock_id`→stocks (cascade delete).
- **Fields:** `place_id`, `status_id`, `user_id`, `weight`, `pieces`,
  `created_at`, `updated_at` (controllers often copy the stock's `updated_at`).
- **Nature:** explicit movement/change record written by controllers on every
  transfer, receive, sale, correction and weight/pieces edit. It is the
  de-facto **stock movement history**. Mutable in practice: corrective flows
  **delete the most recent log row** (`SaleController::destroy`,
  `HomeController::handleRemoveSale`, `OrderController::collectClearSale`).
- **Also** implements Laravel Auditable (so an `audits` row may also exist).
- **Aitvaras need:** **yes.** Movement history is central. Note that legacy log
  rows can be deleted on correction, so legacy history is not strictly
  append-only.

### StockStatus (`stock_statuses`) — seeded lifecycle

| id | name | meaning |
|----|------|---------|
| 1 | Sandėlyje | in warehouse |
| 2 | Kelyje (į gamybą) | in transit to manufacturing |
| 3 | Gamyboje (rūšiavime) | at manufacturing (sorting) |
| 4 | Gamyboje (pakavime) | at manufacturing (packing) |
| 5 | Kelyje (į sandėlį) | in transit to warehouse |
| 6 | Atkrautas | dispatched/sold |

**Observed caveat:** status **2** (`Kelyje į gamybą`) is seeded and referenced
in reads, but the transfer flow in `TransferController::storeTransfer` sets
status **3/4** directly and the “warehouse → manufacturing” receive path is
**commented out/deprecated**. So status 2 may be **unused** in current practice.
**Inferred; needs user confirmation.**

### StockType / StockCategory / Container

- `stock_types`: `name`, `category_id`, `container_id`, `price` (nullable,
  cents). Seeded with 43 types: 3 raw material (`Dėvėti drabužiai/batai/daiktai`),
  16 semi-finished, 24 production codes (`CEMA`, `TSXX`, …).
- `stock_categories`: `Žaliava` (1), `Pusgaminis` (2), `Produkcija` (3).
- `containers`: `Dėžė` (box, 0.8 kg) and `Maišas` (bag, 0.2 kg). Tare weight is
  used in residual/weight calculations when `APP_REPORT_CALCULATION=container`.
- **Aitvaras need:** **yes as reference data.** These are small, mostly stable
  dictionaries; likely safe to mirror/import. Type codes are operational
  vocabulary and probably must be preserved for users.

### Places / PlaceTypes / PlaceGroups / Locations

- `places`: `type_id`→place_types, `name`, `group_id`→place_groups (nullable).
  Seeded places `S1` (warehouse), `R1/R2` (sorting), `P1/P2` (packing); plus a
  production place id `40` (accountant).
- `place_types`: `Sandėliai` (1), `Rūšiavimas` (2), `Pakavimas` (3).
- `place_groups`: real workstations — `R stalai`, `C+E stalai`, `VAIKŲ stalai`,
  `RŪŠIS`, `BATAI iš originalo`, `BATAI Anglija` (seeded 1–6).
- `locations`: storage positions inside a warehouse place.
- `place_stock_types`: which types each place may handle.
- **Aitvaras need:** **yes as reference data.** Places/locations encode physical
  layout and are likely tenant/instance-specific.

### Partners: Supplier / Buyer / Country

- `suppliers` / `buyers`: `name`, `country_id`→countries, `deleted_at` column.
  - **Observed discrepancy:** both models import `SoftDeletes` and declare
    `$dates = ['deleted_at']` but **do not apply the trait**, so the
    `deleted_at` column is effectively unused/inert. Only `User` actually uses
    `SoftDeletes` in the whole application.
- `suppliers.id = 1` = `(iš vidaus)` (internal source, default).
- `countries`: seeded list whose ids resemble **ISO 3166-1 numeric codes**
  (e.g. Lithuania = 440, GB = 826). This is the one dictionary likely
  consistent across instances.
- **Aitvaras need:** **yes as reference data**; buyers/suppliers are
  per-instance and mutable.

### Order / OrderStatus / OrderStockType

- `orders`: `buyer_id`, `user_id`, `name` (free text; not a structured order
  number), `status_id`, `comment` (nullable, added 2026-02).
- `order_statuses`: `Renkamas` (1), `Surinktas` (2), `Atkrautas` (3).
- `order_stock_types`: `order_id`, `type_id`, `weight` (expected),
  `price` (cents), `user_id`. One row per ordered stock type; managed by
  delete-and-reinsert on edit (`OrderController::stockUpdate`).
- **Aitvaras need:** **yes, core** for the order/dispatch domain. `name` being
  free text and the absence of an explicit order line for collected stock are
  important modelling observations.

### Sale (`sales`)

- `sales`: `stock_id`→stocks, `buyer_id`→buyers, `user_id`→users.
- Created one-by-one or mass from scanned barcodes; sets stock `status_id = 6`.
- A stock has `hasOne` sale. Deleting a sale resets the stock to status 1 and
  deletes the latest `stock_logs` row (not a soft reverse).
- **Aitvaras need:** **yes, core** for dispatch/`atkrovimai`.

### StockError (`stock_errors`)

- `sorting_place_id`, `packing_place_id`, `type_id`, `weight`, `user_id`.
- No status, no stock reference; a standalone weight-discrepancy record.
- **Unknown:** whether it feeds payroll/accounting (the repo readme hinted at a
  salary impact) and who reviews it. Needs business confirmation.
- **Aitvaras need:** **likely**, but semantics unconfirmed.

### User / Role

- `users`: `name`, `surname`, `login` (unique per instance; this is the
  credential, **email is commented out**), `password` (bcrypt), `role_id`
  (single role), `disabled` (boolean), `allowed_ips` (CSV, default
  `185.2.229.94/32`), `is_owner` (boolean, added 2018), `remember_token`,
  timestamps, `deleted_at` (SoftDeletes **is** applied here).
- `roles`: 6 seeded roles (see §1).
- Authorization: session auth (`Auth::routes()`), policies per model
  (`app/Policies/`), middleware `CheckAdmin`, `CanSeeReports`, `CheckIp`.
- **Aitvaras need:** **yes**, but Aitvaras should own its own identities; legacy
  users are per-instance and their passwords cannot/should not be reused.

### Audits / history

- `audits` (Laravel Auditing): `user_id`, `event`, `auditable_type` +
  `auditable_id` (morph), `old_values`, `new_values`, `url`, `ip_address`,
  `user_agent`, timestamps. `config/audit.php` uses the database driver.
- 15 domain models implement `Auditable` (Stock, StockLog, Order, OrderStockType,
  Sale, StockError, Place, PlaceType, PlaceGroup, Location, StockCategory,
  StockType, Container, Supplier, Buyer). `User` is `Auditable` + `SoftDeletes`.
- **Important:** the primary movement history is `stock_logs`, not `audits`;
  `audits` is a secondary generic change log and is **not** a substitute for a
  designed event history.
- **Aitvaras need:** history matters; Aitvaras should design an explicit,
  append-only history rather than copy this dual mechanism.

### Messenger (threads/messages/participants)

- Vendored `cmgmyr/messenger` tables and a `MessagesController` with routes.
- `config/menu.php` does **not** expose a messages entry for any role, and the
  feature is not referenced in the main workflows. **Inferred: likely unused.**
  Needs confirmation before deciding to ignore it.

## 3. Stock status transition graph (observed from controllers)

```text
                 register (warehouse)                 register (manufacturing)
                         │                                     │
                         ▼                                     ▼
   ┌──────────────► (1) Sandėlyje                        (4) Gamyboje/pakavime
   │                    │  │                                    ▲
   │   transfer to mfg  │  │  warehouse→warehouse               │ edit
   │   (sets 3/4)       │  └──────────────► (5) Kelyje į sandėlį
   │                    │                          │ receive (sets 1)
   │                    ▼                          │
   │             (3) Rūšiavimas ──edit──► (4) Pakavimas
   │                    │                          │
   │                    └──── return to warehouse ─┘ (sets 1)
   │
   │  sale / order sell / mass sale        remove sale (correction)
   └──────────────────────── (6) Atkrautas ────────────────────────────┘

   Status (2) Kelyje į gamybą: seeded and read, but no active write path found.
```

Key rules:

- Warehouse→sorting/packing sets status from the **destination place type**
  (2→3, 3→4). `TransferController::storeTransfer`.
- Manufacturing→warehouse sets status **1 directly** (the “transit to
  warehouse” step is only used in warehouse↔warehouse flows).
- Warehouse→warehouse sets status **5** then receive sets **1**; with
  `APP_DIRECT_TRANSFER=true` the receive step accepts statuses 1 or 5 and the
  transfer redirects straight to receive.
- Sale/dispatch sets status **6** and creates a `sales` row.
- Corrections delete the latest log and reset to status 1.

## 4. Where business rules live

The app is a fat-controller Laravel monolith. Validation, status logic,
persistence and aggregation all live in controllers:

- `HomeController` — barcode action dispatcher (transfer/receive/show/search/
  register sale/collect order/remove sale) and barcode splitting.
- `StockController` — registration, edit, barcode generation, search/filter.
- `TransferController` — transfers, mass transfers, receives, partial transfers.
- `OrderController` — orders, order lines, collection, completion, sell,
  partial sale.
- `SaleController` — single/mass dispatch.
- `StockErrorController` — discrepancy records.
- `Admin\ReportController` — 11 report screens, ~1,900 lines, including the
  `APP_REPORT_CALCULATION` (weight vs container) switch.
- `Admin\*Controller` — CRUD for dictionaries.
- Policies in `app/Policies/` — role-based gates.
- There is **no service/repository layer** and **no meaningful automated test
  suite**, so behaviour is not specified anywhere except in controller code.

## 5. External integrations (observed)

- **Barcode rendering:** server-side via `milon/barcode` (`DNS1D`, C93/C39) —
  in-process, no external system.
- **Sentry:** error reporting DSN configured (`config/app.php`). Telemetry only.
- **SMTP:** Mailtrap (test) configured; not real delivery.
- **No outbound API, webhook, queue consumer or file exchange** was found.
- `.env` operational flags: `CHECK_IP`, `APP_LOCALE`, `APP_CURRENCY`,
  `APP_HEADER_COLOR`, `APP_REPORT_CALCULATION`, `APP_DIRECT_TRANSFER`.

## 6. Summary of Aitvaras-relevant risks

1. **Per-instance integer ids only**; nothing is globally unique and barcodes
   are neither globally nor even per-instance unique.
2. **Multi-instance deployment**: seven databases with the same schema; a
   canonical one is not confirmed.
3. **Mutable current state + deletable "history"**: `stocks` changes in place
   and corrective flows delete recent `stock_logs` rows.
4. **Semantics encoded in seeded ids** and one hardcoded place id (40).
5. **Free-text order `name`**, no structured order number.
6. **Inactive features** (status 2, messenger, several commented routes) must
   not be assumed to be requirements.
7. **Unclear audit vs log split**: two overlapping history mechanisms.

## 7. Related documents

- `docs/legacy-workflows.md` — workflow flows derived from this map
- `docs/identity-strategy.md` — how to reference legacy entities safely
- `docs/data-ownership.md` — ownership and migration matrix
- `docs/integration-boundaries.md` — the boundary principle and options
- Workspace: `../../docs/discovery/legacy-system.md`,
  `../../docs/business/known-workflows.md`
