# TODO — Aitvaras Roadmap

High-level navigation. Detailed work lives in `tasks/current/` and
`tasks/done/`. See [docs/scope.md](docs/scope.md): Aitvaras builds **confirmed
requirements only**, step by step. Discovery artifacts are **not** a roadmap.

Status legend: **DONE** · **CURRENT** · **NEXT** · **LATER / DISCOVERY ONLY**

---

## DONE

- **Foundation harness** — pnpm workspace, `apps/{api,web}`,
  `packages/{config,contracts,database}`, task journal, docs, `pnpm verify`.
- **Persistence foundation** — PostgreSQL + Prisma configured.
- **Scope clarification** — legacy discovery explicitly marked as unapproved
  discovery, not a roadmap (`docs/scope.md`, ADR-004).
- **Identity & access foundation (ATV-004 / O-036)** — the only confirmed
  functional scope:
  - users (unique username, Argon2id hash, active flag), explicit roles;
  - `POST /auth/login`, `GET /auth/me`;
  - global JWT auth guard + roles guard with `@Roles`/`@Public`/`@CurrentUser`;
  - admin-only `/users` (list, create, patch roles/active/password);
  - four confirmed roles (ADMIN, WAREHOUSE_WORKER, ACCOUNTING,
    PRODUCTION_MANAGER) seeded as configuration;
  - safe, idempotent admin bootstrap (`pnpm bootstrap:admin`);
  - web login flow + admin users page;
  - unit + DB integration tests; `pnpm verify` passes.
  - Docs: `authentication.md`, `authorization.md`.
- **Foundation aligned with current tech (ATV-005 / O-038)** — Prisma ORM
  `7.10.0` (new `prisma-client` generator + `@prisma/adapter-pg`); API moved to
  `src/modules/*`, `src/infrastructure/*`, `src/common/*`. ADR-008 (amends
  ADR-002).
- **Identity refinement + dev ports (ATV-006 / O-039)** — required
  `firstName`/`lastName` display fields (username remains the login credential);
  `RoleKey` enum with the relational multi-role model retained; local ports
  default to API `3010` / Web `3011` (configurable). ADR-009 (amends ADR-007).
- **Lithuanian UI, dev seed, clean initial migration (ATV-007 / O-040)** — UI is
  Lithuanian only (no i18n framework; monochrome preserved); English role keys
  with centralised Lithuanian labels; guarded `pnpm seed:dev`
  (`localdev`/`localdev`, development+local only) separate from secure
  bootstrap; pre-release migration chain consolidated into one
  `initial_identity_access` migration. ADR-010.
- **Brand assets integrated (ATV-008 / O-041)** — approved logos used via a
  responsive `BrandMark` (symbol narrow / horizontal wide) on login, shell and
  admin; favicon set to the symbol. UI-only (`docs/branding.md`).
- **Favicon + footer polish (ATV-009 / O-042)** — light-background favicon;
  minimal footer `© Alfasis UAB · Aitvaras v{version}` on all screens; version
  single-sourced from root `package.json`. UI-only.
- **Auth hardening (ATV-010 / O-044)** — httpOnly cookie auth (no localStorage),
  logout, credentialed CORS, CSRF decision, login rate limiting/lockout,
  accessible password toggle. ADR-011.
- **Login UX / dev reliability (ATV-011 / O-045)** — non-destructive dev seed
  test (localdev survives `pnpm verify`), corrected eye-icon semantics,
  development-only login hint, clearer login error mapping.
- **Test DB isolation (ATV-012 / O-046)** — integration tests use a dedicated
  `aitvaras_test` DB via `TEST_DATABASE_URL` with a safety guard; the
  development database is never touched by tests.
- **Application shell + profile (ATV-013 / O-048)** — sticky top bar, brand,
  role-aware navigation, user menu, and `/profile` self-service (names +
  password change) via `PATCH /auth/me`. Navigation contains only confirmed,
  implemented functionality.
- **Lithuanian UI terminology (ATV-014 / O-049)** — user-facing Role/Roles →
  `Vaidmuo`/`Vaidmenys`, Status/Statuses → `Būsena`/`Būsenos`; technical
  identifiers stay English. Rule recorded in `AGENTS.md`; guarded by
  `terminology.test.ts`.
- **Business partners (ATV-015 / O-051)** — first confirmed business-domain
  module. One unified `BusinessPartner` (never separate supplier/buyer),
  multi-valued business roles `SUPPLIER`/`BUYER` (Tiekėjas/Pirkėjas), required
  name + ≥1 role, active/inactive lifecycle (deactivate, not delete),
  free-text country, no speculative uniqueness. `GET/POST/PATCH /partners`;
  viewing authenticated, mutation `ADMIN`. UI `/partners`, `/partners/new`,
  `/partners/[id]`; navigation `Partneriai`. Docs: `partners.md`,
  `domain-glossary.md`.
- **Resources, categories & packing forms (ATV-016 / O-052)** — second confirmed
  business-domain scope. `Resource` (name required, exactly one category, notes,
  active/inactive lifecycle, no name uniqueness) with fixed categories
  `RAW_MATERIAL`/`SEMI_FINISHED`/`FINISHED_PRODUCT` (Žaliava/Pusgaminis/
  Gaminys); `PackingForm` as independent reference data (Dėžė, Maišas, Metalinis
  narvas, Rulonas) with an explicit idempotent seed (`pnpm seed:reference`) — not
  a resource property. `GET/POST/PATCH /resources` and `/packing-forms`; UI
  `/resources`, `/resources/new`, `/resources/[id]`, `/resources/packing-forms`;
  navigation `Ištekliai`. Docs: `resources.md`, `domain-glossary.md`.
  *(Superseded: the redundant `PackingForm` concept and its seed were removed in
  ATV-049; `PackagingType` / `Tara` is now canonical.)*
- **User administration fix + ADMIN role UX (ATV-017 / O-053)** — root-caused the
  `Naudotojai` edit/disable failures to Fastify's CORS default methods
  (`GET,HEAD,POST`); fixed by setting allowed methods explicitly (browser
  `PATCH` now works everywhere). Enforced ADMIN dominance server-side
  (`normalizeRoleKeys`), added last-active-admin + self-admin-change guards,
  the `Įjungti` label, specific error mapping and immediate table refresh.
- **Frontend refactor to FSD-lite (ATV-018 / O-055)** — `apps/web/src`
  reorganised into `app` / `widgets` / `features` / `entities` / `shared` with
  downward-only dependencies. Architecture-only; see
  `docs/frontend-architecture.md`.
- **Backend architecture rules (ATV-019 / O-056)** — modular-monolith baseline
  and evolution rules recorded in `docs/backend-architecture.md`.
- **Goods receipts / Pajamavimas (ATV-020 / O-058)** — first minimal receipt
  workflow: one supplier partner (active + `SUPPLIER`) and 1..n lines (resource,
  quantity, unit `kg`/`vnt.`, unit price); decimal-safe persistence; atomic save;
  list + read-only detail. No stock, status lifecycle, accounting or
  `PATCH`/`DELETE`. Auth: authenticated (not ADMIN) for list/read/create. Docs:
  `receipts.md`, `domain-glossary.md`.
- **Warehouses & receipt placement (ATV-021 / O-059)** — `Warehouse` +
  `WarehouseLocation` (a location always belongs to exactly one warehouse;
  names unique per warehouse, not globally) with active/inactive lifecycle;
  ADMIN manage UI at `/warehouses`, `/warehouses/[id]`; navigation `Sandėliai`.
  Receipt lines require a per-line `warehouseId`, with a dependent location
  selector; the server enforces location-belongs-to-warehouse. Migration
  `warehouse_placement`. Still **no** stock movements/balances. Docs:
  `warehouses.md`, `receipts.md`.
- **Optional receipt location (ATV-022 / O-060)** — `GoodsReceiptLine.warehouseId`
  stays required; `warehouseLocationId` is nullable (migration
  `optional_receipt_location`); the API validates a location only when supplied.
- **Inactive-row and destructive-action styling (ATV-023 / O-061)** —
  `shared/lib/row-styles.ts`: inactive rows muted, `Išjungti` destructive,
  `Įjungti` neutral. UI-only.
- **Detail-level toggle styling (ATV-024 / O-062)** — shared
  `toggleActionClass(active, size)` for table and detail actions. UI-only.
- **Receipt form visual separation (ATV-025 / O-063)** — receipt-entry card uses
  the `bg-muted` work surface. UI-only.
- **Consistent active-work surfaces (ATV-026 / O-064)** — `shared/lib/surfaces.ts`
  applied to create/edit areas. UI-only.
- **Administrator-driven password reset (ATV-027)** — admin-only
  `PATCH /users/:id/password` sets a user's password using the shared ≥ 6-char
  policy. The target's existing sessions are invalidated immediately via a bumped
  `tokenVersion` (JWT `ver` claim checked by the auth guard). The old password is
  never requested/returned; no email recovery or reset tokens. Generic
  `PATCH /users/:id` no longer accepts a password. Inline reset form in the user
  edit panel. Docs: `authentication.md`, `authorization.md`.
- **Administrator-managed resource categories (ATV-028)** — replaced the fixed
  `ResourceCategoryKey` enum with a first-class `ResourceCategory` master-data
  entity. `Resource.categoryId` is now a foreign key; the three historical
  categories are seeded once by the `managed_resource_categories` migration,
  which remaps existing resources without loss. New `resource-categories` API
  (authenticated read, ADMIN write; no delete) and `/resources/categories` UI.
  The resource form loads categories from the API (active-only for new; keeps an
  inactive assigned category when editing). Docs: `resources.md`,
  `domain-glossary.md`, `scope.md`.
- **Receiving batches & bags (ATV-029)** — first slice of the confirmed
  inventory direction. `Batch` (Partija) records one delivery of one resource
  from one active `SUPPLIER` into one warehouse, with a system-generated
  unique code (now compact/delivery-local `P01`..`P99`; see ATV-047), arrival
  date and `PENDING` status;
  `Bag` (Maišas) is one physical handling unit with its own measured weight, an
  optional location (must belong to the batch warehouse) and a unique
  EAN-13-shaped barcode that encodes no business data. `GET/POST /batches`,
  `GET /batches/:id` (+ `/bags`), `POST /batches/:id/bags` and
  `GET /bags/by-barcode/:barcode` (reads authenticated; batch/bag creation
  `ADMIN`/`WAREHOUSE_WORKER`). Migration `receiving_batches_and_bags`. UI
  `/receipts/batches`, `/receipts/batches/[id]` (add bags + label preview/print)
  reached from `Pajamavimas`. Totals are derived, never stored; **no stock
  tables**. Confirmation, batch↔receipt link, scan-driven movement, production
  lineage and costing deliberately out of scope. Docs: `batches.md`,
  `domain-glossary.md`, `scope.md`, `receipts.md`.
- **Batch ↔ GoodsReceipt reconciliation (ATV-030)** — the second receiving slice.
  `Batch.receiptLineId` (nullable, unique) explicitly links a physical batch to a
  formal `GoodsReceiptLine` (`GoodsReceipt → GoodsReceiptLine → Batch → Bags`);
  `GoodsReceipt` gains optional `documentDate`/`documentNumber`; `Batch` gains
  `documentWeight`, `acquisitionAmount`, `confirmedAt`. New ADMIN-only
  `POST /batches/:id/reconcile`: the server derives the measured weight from the
  bags, compares it with the entered **documentary** weight, and sets `CONFIRMED`
  (exact) or `DISCREPANCY`; a discrepancy re-reconciles once corrected. Physical
  (bags) and documentary (receipt) quantities stay separate; no bags, receipt
  lines or stock are created. Migration `batch_reconciliation`. UI reconciliation
  form + confirmed summary on the batch detail page. Explicit error codes. Docs:
  `batches.md`, `receipts.md`, `domain-glossary.md`, `scope.md`,
  `authorization.md`. Out of scope: tolerance percentages, VAT/accounting,
  production/transformations, output lots, cost redistribution, order allocation,
  bag split/merge, barcode hardware.
- **Warehouse-worker receiving UI (ATV-031)** — role-specific UI follow-up on the
  ATV-029/030 model; no reconciliation/data/authorization changes. The worker's
  home (`/`) is a focused operational workplace with a prominent `Registruoti
  sandėlyje` action; a new `/receiving` flow (protected by the receiving roles)
  supports `Nauja partija` (supplier/resource/warehouse/arrival date only) or an
  existing open `PENDING` batch (with code/supplier/resource/arrival/bag
  count/measured context), then fast bag registration (`Svoris`, `Vieta`) with an
  immediate label preview (barcode + batch code + weight + resource). Worker
  navigation hides the formal `Pajamavimas` and shows `Registruoti sandėlyje`;
  `ADMIN` keeps full access. Formal fields (documentary weight, acquisition,
  document number/date, reconciliation controls) never appear in the worker flow.
  Docs: `batches.md`, `domain-glossary.md`, `authorization.md`.
- **Handling-unit quantities, required location & label (ATV-032)** — generalised
  the handling unit from a bare weight to a **quantity + measurement unit**
  (`KG`/`PCS`; `kg`/`vnt`; default `KG`): `KG` decimals, `PCS` whole units only;
  one unit per batch (first unit establishes it). Warehouse location is now
  **required** (API/contracts/DB, friendly Lithuanian message) and must belong to
  the batch warehouse. The next unit preselects the **last-used location**
  (`suggestedLocationId`, derived from persisted data). Save action is
  `Išsaugoti ir spausdinti` and invokes the browser print preview. Label now shows
  warehouse, location, category, resource, batch code, quantity with unit, and a
  scannable **EAN-13 barcode graphic**. Reconciliation stays weight-based and
  applies to `KG` batches only (`BATCH_NOT_WEIGHT`); unit consistency is enforced
  (`UNIT_MISMATCH`). Migration `handling_unit_quantity` (rename `weight`→
  `quantity`, add `unit`, require location). Docs: `batches.md`,
  `domain-glossary.md`, `scope.md`.
- **Save → label surface (ATV-033)** — narrow warehouse-worker UX follow-up:
  `Išsaugoti ir spausdinti` persists the unit and goes **straight to the label
  surface** (no intermediate detail page); the browser print preview is invoked
  from the label. Closing the label returns to the same receiving form with the
  batch and last-used location preserved, the unit kept, and only the quantity
  reset. A failed save never opens the label and keeps the form data. State
  modelled as pure helpers/tests (`bag mode state`). No API/data-model change.
- **Batch units list on the receiving screen (ATV-034)** — narrow UX follow-up.
  Renamed the open-batch heading to `Nepatvirtintos partijos` (status enum
  unchanged) and added a `Partijos maišai` section below the entry form listing
  the selected batch's registered units newest-first with `Barkodas`, `Vieta`,
  `Kiekis`, `Mato vnt.`, `Užregistruota` and a `Spausdinti dar kartą` action that
  reuses the existing unit's label (no new unit/barcode). Compact empty state
  `Šioje partijoje dar nėra užregistruotų maišų.`; the list refreshes immediately
  after each save. No API/data-model/authorization change.
- **Split save action + icons (ATV-035)** — narrow worker UI follow-up. The single
  `Išsaugoti ir spausdinti` is split into **`Išsaugoti ir spausdinti`** (primary;
  creates the unit, opens the label + print) and **`Išsaugoti`** (secondary;
  creates the unit and returns to the form), each creating exactly one unit via a
  shared create path. Both keep the batch and last-used location and reset only
  the quantity. The units-list reprint action is renamed `Spausdinti dar kartą` →
  `Spausdinti`. Restrained decorative inline-SVG icons (Save/Printer/Plus) added
  following the existing inline-SVG convention (Lucide is not installed; no new
  dependency added). No API/data-model/authorization change.
- **Pointer cursor convention (ATV-036)** — small UI-convention cleanup. No shared
  `Button` component exists, so a single app-wide base-layer rule
  (`button:not(:disabled), [role="button"]:not([aria-disabled="true"]) { cursor:
  pointer }`) in `apps/web/src/app/globals.css` gives all clickable actions a
  pointer cursor while disabled controls keep their disabled semantics. Recorded
  as a permanent UI rule in `AGENTS.md`. No redesign, colour or size change.
- **ADMIN reconciliation boundary cleanup (ATV-037)** — narrow domain-boundary
  follow-up. The ADMIN batch-detail screen no longer exposes the technical
  `Pajamavimo eilutė` (`GoodsReceiptLine`) selector and no longer contains
  bag-creation controls (`Pridėti maišą`); it shows a **read-only** unit list
  (barcode, location, quantity, unit, registered timestamp; optional label
  reprint) and a formal-only reconciliation form. The internal
  `GoodsReceipt → GoodsReceiptLine → Batch` model is unchanged, but the receipt
  anchor is resolved **server-side** (`resolveReceiptLine`: reuse the batch's
  linked line on retry → reuse a compatible unlinked line → create a receipt+line
  from the batch + formal data), so no duplicate records on retry. The
  `ReconcileBatchRequest` contract no longer accepts `receiptLineId`. Worker
  `Registruoti sandėlyje` flow unchanged.
- **Gavimai admin queue (ATV-038)** — information-architecture cleanup. Renamed
  the top-level `Pajamavimas` nav label to **`Gavimai`** (route `/receipts`
  unchanged) and the landing heading to **`Gautos partijos`**. Removed the manual
  GoodsReceipt creation form (and the whole `manage-receipts` UI: create form,
  receipts list, receipt detail) and the ADMIN batch-create form from the listing:
  `Gavimai` opens directly to the received-batch queue (`Partija`, `Priėmimo
  data`, `Tiekėjas`, `Išteklius`, `Sandėlis`, `Maišai / kiekis`, `Būsena` +,
  `Peržiūrėti`) with client-side filters (status — default `Reikia patvirtinti` =
  `PENDING`+`DISCREPANCY`; supplier; resource; warehouse; arrival date range;
  batch-code search). `GoodsReceipt`/`GoodsReceiptLine` remain the internal
  formal-document model, created/linked server-side by reconciliation. Worker
  `Registruoti sandėlyje` flow unchanged; detail screen unchanged.
- **`Gavimai` row interaction & status colours (ATV-039)** — narrow UI follow-up.
  Removed the `Peržiūrėti` action column; each row is now a whole-row **link**
  (stretched overlay, keyboard focus with a visible ring, subtle hover/focus
  background) to `/receipts/batches/[id]`, with no nested interactive controls.
  Rebalanced columns (`whitespace-nowrap` on code/date/quantity/status).
  Restrained semantic status colours (`CONFIRMED` → `text-emerald-500`,
  `DISCREPANCY` → `text-rose-500`, `PENDING` → muted; text only, no coloured
  row). No filtering/reconciliation/authorization/API/data-model change.
- **`Gavimai` detail links & confirmation wording (ATV-040)** — tiny ADMIN detail
  cleanup. The batch detail page's back link now points to the active `Gavimai`
  queue (`← Gavimai`, `/receipts`) instead of the removed `Partijos` list. The
  formal reconciliation card heading and primary button are `Patvirtinti gavimą`
  (constant `CONFIRM_RECEIPT_LABEL`), and the success/error copy uses `gavimas`
  instead of `pajamavimas`. Worker `Registruoti sandėlyje` navigation unchanged;
  no reconciliation/data/API/authorization change.
- **Filter reset & physical unit correction/void (ATV-041)** — the `Gavimai`
  filter panel gains **`Atstatyti filtrus`** (clears every filter to the default
  `Reikia patvirtinti` view; disabled when no filter is active). The worker
  `/receiving` flow now also lists `DISCREPANCY` batches under **`Reikia
  patikslinti`** and lets the worker fix the **physical** units: `Bag` gains
  `status ACTIVE|VOIDED` (+ `voidedById`/`voidedAt`/`voidReason`) and a new
  append-only `BagCorrection` audit model (`QUANTITY`/`LOCATION`/`VOID`);
  `PATCH /batches/:id/bags/:bagId` corrects quantity/location and
  `POST /batches/:id/bags/:bagId/void` voids a unit (never deleted). Totals
  (`bagCount`/`totalQuantity`) and reconciliation count **active** units only; a
  unit is correctable/voidable only while the batch is `PENDING`/`DISCREPANCY`
  (a `CONFIRMED` batch is frozen). A physical correction does not clear a
  `DISCREPANCY` by itself. Worker UI: inline `Taisyti`/`Anuliuoti` panels, voided
  rows muted, `Anuliuoti maišai` list. ADMIN detail: unit `Būsena` column and a
  `Pataisymų istorija` table. Migration `handling_unit_corrections`. Docs:
  `batches.md`, `scope.md`, `domain-glossary.md`, `authorization.md`, `AGENTS.md`.
  Out of scope: bag split/merge, post-confirmation corrections, barcode hardware.
- **Incoming deliveries (Gavimas) with multiple resource batches (ATV-042,
  corrected)** — the confirmed real workflow: one physical arrival = **one
  supplier + one arrival date**, containing several resources; each resource goes
  into **one warehouse per batch**. New `IncomingDelivery` (`Gavimas`) aggregate,
  human-facing code `GYYMM-NN` (month-sequenced, unique, max 99). `Batch` owns
  `deliveryId`, `resourceId` and `warehouseId` (+ `@@unique(deliveryId,
  resourceId, warehouseId)`) and an optional nullable `documentPieces`. Physical
  receiving is **weight-based**: `Bag.weight` (no KG/PCS unit; the
  `HandlingUnitKey` enum and unit selectors were removed; `bags.quantity` renamed
  to `bags.weight`, correction kind `QUANTITY`→`WEIGHT`). New `/deliveries` API
  (`POST` supplier+arrival, `GET`, `GET /:id`, `POST /:id/batches` resource+
  warehouse); the old `POST /batches` was removed and `POST /batches/:id/bags`
  takes `{weight, warehouseLocationId}`. Delivery-centric worker UI (`Naujas
  gavimas`/`Pradėti gavimą`, `Registruojama rūšis` resource+warehouse,
  `Kitas išteklius`, `Gavimo turinys`, package `Vieta`+`Svoris`); labels show
  `Gavimas: GYYMM-NN` + actual weight; ADMIN queue/detail show the delivery code
  and the optional `Dokumentiniai vienetai`. Migration `incoming_deliveries`
  (rewritten, uncommitted) backfills one delivery per existing batch, keeps the
  batch warehouse, and preserves every package weight. Out of scope: the
  long-lived discrepancy register, historical delivery grouping, vehicles, bag
  split/merge, per-package piece allocation.
- **Packaging / tare master data (ATV-043)** — new `PackagingType` (`Tara`) master
  data (name, `tareWeightKg` Decimal(14,3), active) with ADMIN list/create/edit/
  activate (`/packaging-types`) and a `/resources/packaging-types` page. Handling
  units store `packagingTypeId`, `grossWeight` and the server-derived
  `netWeight = gross − tare`; gross ≤ 0 / gross ≤ tare (`GROSS_NOT_ABOVE_TARE`) and
  inactive packaging (`PACKAGING_INACTIVE`) are rejected for new receiving, while
  historical packages may reference inactive packaging. Measured/reconciliation
  totals use **netWeight**; labels show net (gross/tare secondary). Corrections
  allow packaging/gross/location and recompute net, appending `PACKAGING`/
  `GROSS_WEIGHT`/`LOCATION` audit rows. Migration `packaging_types` attaches
  historical packages to an inactive `Nežinoma tara` (tare 0). Docs:
  `packaging-types.md`, `batches.md`, `domain-glossary.md`, `scope.md`,
  `authorization.md`, `AGENTS.md`. Out of scope: per-package piece allocation,
  packaging-type hard delete.
- **Bag tare snapshot (ATV-044)** — narrow follow-up. `Bag.tareWeightKg`
  (Decimal(14,3)) snapshots the tare used for the bag's current net weight, so
  `grossWeight − tareWeightKg = netWeight` stays true historically even if the
  PackagingType master tare is edited later. Creation snapshots the active type's
  tare; a packaging correction re-snapshots the selected type's tare and recomputes
  net, recording the previous/new packaging name **and tare** in the `PACKAGING`
  audit row. Reads/labels use the bag snapshot (packaging name still from the
  referenced type). Integrated into the uncommitted `packaging_types` migration
  (`tare_weight_kg`, historical rows = 0.000, gross = net preserved); local dev/test
  DBs rebuilt (consented). No workflow/architecture change. Docs:
  `packaging-types.md`, `batches.md`.
- **Receiving `Pakuotė` terminology and tare persistence (ATV-045)** — narrow UX
  follow-up. Active receiving UI uses the generic term **`Pakuotė`** instead of
  the bag-specific `Maišas` (`Nauja pakuotė`, `Partijos pakuotės`, `Pakuotės`
  headers, `Anuliuotos pakuotės`, `Anuliuoti pakuotę`, `Koreguoti pakuotę`);
  `Tara` stays the packaging selector label; internal `Bag` is unchanged. After
  save the active batch/`Tara`/location are preserved and only the gross weight is
  cleared. New server-derived `BatchDetail.suggestedPackagingTypeId` (latest
  **active** package; `null` when none) makes the tare selection survive
  refresh/re-entry; a voided package is never suggested; `Kitas išteklius` does
  not inherit the previous batch's tare. No schema change. Docs: `batches.md`,
  `packaging-types.md`, `domain-glossary.md`.
- **Non-blocking discrepancy confirmation + register (ATV-046)** — a mismatch no
  longer blocks confirmation. Exact match confirms with no discrepancy; a mismatch
  requires explicit `acknowledgeDiscrepancy: true`, then confirms and records a
  long-lived `ReceivingDiscrepancy` (OPEN) with measured/document/signed difference
  (`measured − document`). `BatchStatus` simplified to `PENDING | CONFIRMED` (the
  `DISCREPANCY` value removed); the physical stock stays the measured net weight.
  Confirm + discrepancy creation are one transaction (unique `batchId`), so retry
  cannot duplicate. ADMIN detail shows a modal on a non-zero difference and the
  signed-difference success message; `Gavimai` shows confirmed-with-discrepancy as
  confirmed + `Neatitikimas` marker. Migration `receiving_discrepancies`. Docs:
  `batches.md`, `domain-glossary.md`, `scope.md`, `AGENTS.md`. Out of scope:
  discrepancy settlement UI (weight/money) — documented as the next slice.
- **Compact delivery-local batch codes + receiving UI cleanup (ATV-047)** — narrow
  UI/identifier cleanup. Human-facing batch code shortened to the delivery-local
  `P01`..`P99` (first batch `P01`, resets per delivery, max `P99` with
  `BATCH_CODE_EXHAUSTED`; concurrency-safe via a composite unique
  `@@unique([deliveryId, code])` + retry; the UUID stays the technical identity).
  Migration `batch_delivery_local_code` reassigns existing codes deterministically
  per delivery and replaces the global unique `code` index. `Gavimai` filters use
  masculine `Visos`→`Visi` for the generic supplier/resource/warehouse options; the
  default pending queue stays **not date-bounded** (arrival-date filters empty).
  Signed difference shows an explicit `+` for positive (`+19,200 kg`) and `−`
  (U+2212) for negative; mismatch stays rose/red. No stale user-facing
  `Maišas`/`Maišai`; `Pakuotė` = physical package, `Tara` = packaging type/master
  data. Docs: `batches.md`, `domain-glossary.md`, `scope.md`, `AGENTS.md`.
- **Top-navigation information-architecture cleanup (ATV-048)** — focused web IA
  cleanup; routes, authorization and page content unchanged. Top navigation groups
  administration under parents: operational `Pradžia`, `Registruoti sandėlyje`,
  `Gavimai` stay top-level; `Žinynai` (reference data → `Partneriai`, `Ištekliai`,
  `Sandėliai`); `Ataskaitos` (reserved, empty — the future discrepancy
  register/report belongs here); `Sistema` (system administration → `Naudotojai`,
  later `Nustatymai`). New discriminated `NavEntry` model with
  `visibleNavEntries`/`isNavGroupActive`; compact desktop dropdowns
  (`aria-haspopup`/`aria-expanded`, `Escape`, outside-click, active-parent
  highlight) plus a responsive `Meniu` disclosure below `md`. Role visibility
  preserved. Docs: `frontend-architecture.md`, `architecture.md`, `batches.md`,
  `AGENTS.md`.
- **Receiving queue, delivery routes, button hierarchy & PackingForm removal
  (ATV-049)** — receiving/UI consistency pass. (1) `Nepatvirtinti gavimai` is now
  **derived from the child batches** (`pendingBatchCount`, not a stored status): a
  delivery with any `PENDING` batch (or none yet) stays; an all-`CONFIRMED`
  delivery disappears (API `IncomingDelivery.pendingBatchCount`). (2) The selected
  delivery has its own route `/receiving/[deliveryId]` (`/receiving` is the list),
  so the top-level nav/Back work, with a secondary `← Gavimų sąrašas` action
  replacing `Kitas gavimas`. (3) A shared button hierarchy
  (`shared/ui/button.ts`: primary / secondary filled-gray / outline /
  destructive) is adopted for child-nav and back actions. (4) The redundant
  `PackingForm` / `Pakavimo formos` concept was removed (`drop_packing_forms`
  migration): distinct legacy names preserved as `PackagingType` (tare 0, no
  duplicates); `PackagingType` / `Tara` is canonical. Docs: `batches.md`,
  `resources.md`, `packaging-types.md`, `domain-glossary.md`, `scope.md`,
  `architecture.md`, `frontend-architecture.md`, `authorization.md`, `AGENTS.md`.
- **Neatitikimai — discrepancy register + settlement ledger (ATV-050)** — the
  `ReceivingDiscrepancy` register and an append-only `DiscrepancySettlement`
  ledger. Direction `Trūkumas`/`Perteklius` from the immutable signed
  `measured − document`; server-derived balance (`original = |difference|`,
  `settled = Σ coveredWeightKg`, `remaining`) drives `OPEN → PARTIALLY_SETTLED →
  SETTLED` (+`settledAt`). `WEIGHT` (optional link to a confirmed same-supplier
  batch; no stock added) and `MONEY` (amount+currency; no money↔weight
  conversion); settlements never change inventory or the original discrepancy.
  Transactional creation with a row lock prevents over-settlement. ADMIN
  `Ataskaitos → Neatitikimai` register (`/reports/discrepancies`) with filters
  (default `Atviri`, no date bound) and detail + `Padengimų istorija` + settlement
  form. API `GET /receiving-discrepancies`, `GET /:id`,
  `POST /:id/settlements`; migration `discrepancy_settlements`. Docs:
  `discrepancies.md`, `batches.md`, `scope.md`, `domain-glossary.md`,
  `architecture.md`, `authorization.md`, `backend-architecture.md`,
  `frontend-architecture.md`, `AGENTS.md`.
- **Piece-based receiving batches (ATV-051)** — a vertical slice so a real
  PIECE delivery can be entered. `BatchReceivingMode` (`WEIGHT`/`PIECE`) on Batch;
  `Batch.resourceId` is now nullable (PIECE batches own no batch-level resource);
  new `BatchItem` (`resourceId`, `warehouseLocationId`, positive-integer
  `quantity`, `ACTIVE`/`VOIDED` with void metadata) via migration
  `piece_batches`. `POST /deliveries/:id/batches` accepts the mode (WEIGHT keeps
  the existing flow; PIECE takes warehouse only); item add/correct/void endpoints;
  `POST /batches/:id/confirm-piece` (no weight/discrepancy; acquisition + document
  metadata on the batch); narrow `POST /resources/receiving-quick-create` for
  inline product creation. Mode-aware receiving UI (`Partijos tipas` `Svorinė`/
  `Vienetinė`, piece item table + `Iš viso: N vnt.`), Gavimai/batch-detail display.
  Server enforces mode invariants. Docs: `piece-batches.md`, `batches.md`,
  `scope.md`, `domain-glossary.md`, `architecture.md`, `authorization.md`,
  `AGENTS.md`, `README.md`.
- **PIECE resume + barcode-addressable groups (ATV-052)** — correction to the
  unit piece slice after the first manual test. A PENDING PIECE batch is
  **resumable**: it has its own route
  `/receiving/[deliveryId]/batches/[batchId]`; `Gavimo turinys` rows link to it;
  no new P01/P02 is allocated on leave/re-entry. A new code is created **only** by
  the explicit `Nauja partija` action (removed the overloaded `Kitas išteklius`
  from the piece/weight working screen). Each PIECE group now carries a
  **globally-unique opaque barcode** (`BatchItem.barcode`); `Išsaugoti` /
  `Išsaugoti ir spausdinti` + `Spausdinti` reprint (never creates another
  group/barcode/batch) with a compact label (Gavimas/Partija/Prekė/Kiekis/
  Sandėlis/Vieta/barcode). Group list shows `Barkodas` + `Etiketė`. Same product
  entered again → a separate group/barcode (no silent merge). Confirmation
  preserves barcodes and freezes groups. Docs: `piece-batches.md`.
- **Refresh delivery summary after receiving mutations (ATV-053)** — narrow
  state-sync fix. On the batch receiving screen the parent `Gavimo turinys`
  summary was stale until navigation because the PIECE handlers re-fetched only
  the batch. They now use the shared `refreshBatchAndDelivery()` (fetches
  `/batches/:id` + `/deliveries/:id`) and update both the batch and the delivery;
  the server stays authoritative for counts/pieces/weight/status. WEIGHT
  add/correct/void already used the same mechanism. Active batch/product/location/
  route/label state preserved; no full reload or `window.location`. No schema
  change.
- **PIECE product-by-product reconciliation (ATV-054)** — PIECE confirmation now
  reconciles documentary quantities **per product** instead of one batch total.
  The confirmation table is `Prekė | Faktiškai | Sutampa | Dokumentuose |
  Skirtumas`, with `Faktiškai užregistruota` (counted wording, no kg/susverta),
  `Faktiškai` server-derived by aggregating active groups per resource, a
  `Sutampa` checkbox shortcut, and signed `differencePieces = actual − document`.
  New `PieceReconciliationLine` (unique batch+resource; `actualPieces` snapshot)
  and a discrepancy `kind` (`WEIGHT`/`PIECE`) with per-product piece quantities.
  PIECE confirmation creates zero/one/many PIECE discrepancies and an
  acknowledgement dialog on any mismatch; WEIGHT discrepancy + settlement
  unchanged and PIECE settlement is not implemented (register/detail show product
  + `vnt.`, no weight settlement form). Migration `piece_reconciliation`. Docs:
  `piece-batches.md`, `discrepancies.md`, `domain-glossary.md`, `architecture.md`.
- **Sidebar layout + contextual child navigation (ATV-055)** — the horizontal top
  navigation is replaced by a persistent dark left sidebar on desktop and a
  modal drawer below `lg`; the top bar keeps a breadcrumb and the user menu.
  `Žinynai`, `Ataskaitos` and `Sistema` are section destinations whose existing
  children render as route-based horizontal tabs below the page heading
  (`SectionTabs`), so the same navigation is not duplicated. Direct links,
  refresh, back/forward, `Escape`, focus trapping and page-level overflow were
  verified. No route/permission/business change. Screenshots in
  `docs/screenshots/atv-055/`; record in
  `tasks/done/ATV-055-sidebar-layout-and-contextual-navigation.md`.
- **Dashboard label + partner identification (ATV-056)** — `Pradžia` renamed to
  `Suvestinė` (route `/` unchanged). Company partners now require name, an ISO
  alpha-2 `country` selected from a complete searchable Lithuanian country list,
  and a string registration number (`companyCode`; leading zeros preserved, no
  Lithuania-only format). `(country, companyCode)` is unique via a database index;
  duplicates return a Lithuanian field-level error and the same number in another
  country is allowed. Existing data was inspected: 2 partners, both UK → `GB`,
  both missing registration numbers (left NULL, not invented), no duplicates or
  conflicts, linked operations preserved. Test records were cleaned up.
  Screenshots in `docs/screenshots/atv-056/`; record in
  `tasks/done/ATV-056-dashboard-label-and-partner-identification.md`.
- **Receiving entry point, dates and migration repair (ATV-057)** — one
  `Priėmimas` sidebar destination replaces `Gavimai` + `Registruoti sandėlyje`;
  `Gautos partijos` keeps its heading and gains a primary `Naujas priėmimas`
  button to `/receiving/new`. User-facing receipt terminology is now
  `Priėmimas` (internal IDs/codes preserved). All dates use shared `yyyy-mm-dd`
  formatting/input (manual, calendar, clearing, inclusive ranges; timestamps as
  `yyyy-mm-dd HH:mm`) with no timezone day shift. Both WEIGHT and PIECE receiving
  were completed end to end (labels, reopen, confirmation, stock), then test data
  was removed. The `piece_batches` checksum drift was reconciled after a database
  backup by aligning `_prisma_migrations` with the verified current file;
  `npm run db:migrate` is in sync again. Details in
  `docs/migration-history.md`; screenshots in `docs/screenshots/atv-057/`;
  record in `tasks/done/ATV-057-receiving-entry-dates-and-migration-repair.md`.
- **Dashboard stock summary cards (ATV-058)** — the dashboard's large action panel
  is replaced by two read-only cards (`Atsargos kilogramais`, `Atsargos
  vienetais`) showing confirmed-stock quantities and remaining acquisition value,
  with a compact `Naujas priėmimas` action beside the heading. `GET /stock/summary`
  aggregates active confirmed bags (`netWeight`) and PIECE items, adds each
  batch's `acquisitionAmount` once (no per-bag/per-line duplication), excludes
  unconfirmed/voided stock, and marks incomplete valuation instead of treating
  missing cost as zero. Loading/error/empty states are explicit. Screenshots in
  `docs/screenshots/atv-058/`; rules in `docs/stock-summary.md`; record in
  `tasks/done/ATV-058-dashboard-stock-summary-cards.md`.
- **Edit PENDING receiving batches (ATV-059)** — the batch detail page offers
  `Redaguoti partiją` for pending batches and opens the existing registration
  interface prefilled with saved data. Receipt supplier/date (shared scope),
  batch resource/warehouse, bag/tare/gross/location and PIECE
  resource/quantity/location can be corrected; units can be added or voided.
  Save leaves the batch pending and returns to the same detail; confirmed sibling
  batches block shared receipt edits. All content/registration mutations lock the
  batch and reject post-confirmation edits with `409 BATCH_CONFIRMED`; no new
  receipt/batch or barcode is created. List filters persist across the round trip.
  Screenshots in `docs/screenshots/atv-059/`; record in
  `tasks/done/ATV-059-edit-pending-receiving-batches.md`.
- **Global notifications, scroll-to-top, Nustatymai and company details (ATV-060)** —
  the top-right toaster is the single convention for **all** user-action feedback:
  client validation, save/create/update/void/confirm results and API/network
  failures. Inline action banners were migrated away; invalid fields keep
  borders/`aria-invalid` and the first one is focused, entered values survive, and
  multi-field failures produce one concise summary. Colours stay yellow
  info/green success/red error. The scroll-to-top control is now a white circle
  with a black border and black arrow only (`Į viršų` remains label/tooltip).
  `Sistema` was renamed to **Nustatymai** with route-based children `Įmonė`
  (`/settings/company`) and `Naudotojai` (`/admin/users`). Company details are a
  shared singleton (`company_settings`) with ADMIN-only save, shared country
  selector/validation and persistence across refresh. Voided label actions and
  tare labels from the earlier ATV-060 slice remain. Screenshots in
  `docs/screenshots/atv-060/`; record in
  `tasks/done/ATV-060-notifications-scroll-and-receiving-controls.md`.
- **Repository audit and cleanup (ATV-061)** — captured the uncommitted
  ATV-051…060 baseline, replayed all 22 migrations into a disposable database,
  confirmed 22/22 checksums and no schema drift, and recorded exact table counts.
  Removed proven dead API/web helpers left by earlier refactors (duplicate batch
  guards/mappers, obsolete receipt entity, password-reset dead state, superseded
  form/state/style helpers) and fixed confirmed-batch UI protection so package/
  item forms and correction/void actions are not offered after confirmation.
  Corrected stale README/architecture/development/testing/backend/scope/migration
  docs. Report: `docs/audits/ATV-061-audit-report.md`; record:
  `tasks/done/ATV-061-repository-audit-and-cleanup.md`.
- **Clarify discrepancy settlement source batch (ATV-062)** — confirmed that
  `sourceBatchId` means a separate later batch of replacement goods, not the
  original discrepancy batch. The UI now labels it `Papildomai gautų prekių
  partija`, explains it, shows it only for physical/weight settlement, and the
  backend rejects the original batch and any money-settlement link. Partial
  settlement, balance and over-settlement protection are unchanged.
  Record: `tasks/done/ATV-062-clarify-discrepancy-settlement-source-batch.md`.
- **Migrate fully to npm workspaces (ATV-063)** — root npm workspaces,
  `packageManager: npm@12.2.2`, one `package-lock.json`, npm scripts,
  workspace-local dependencies, `allowScripts` approvals, npm-based test-db
  helper, and active docs updated. TypeScript upgraded 5.9.3 → 6.0.2 for
  `@nestjs/schematics@12`; `moduleResolution: node` retains a documented
  `ignoreDeprecations: "6.0"` follow-up. Record:
  `tasks/done/ATV-063-migrate-to-npm-workspaces.md`.
- **Correct logo variants and alignment (ATV-064)** — `BrandMark` explicitly
  selects the dark horizontal artwork on light surfaces and the light artwork on
  dark surfaces; login logo centred above `Prisijungti`, sidebar/drawer logo
  centred with the white wrapper/border/shadow removed. Screenshots in
  `docs/screenshots/atv-064/`; record:
  `tasks/done/ATV-064-logo-variants-and-alignment.md`.
- **Remove fake receiving data for real receiving (ATV-065)** — backed up the
  `aitvaras` development database outside the repository, removed all
  localdev-created fake deliveries/batches/packages/items/corrections/receipts/
  discrepancies/settlements/piece lines in one asserting transaction, and
  preserved partners, resources, categories, packaging, warehouses, locations,
  company settings, users/roles, schema and migrations. Dashboard now shows zero
  stock and the discrepancy register is empty. Record:
  `tasks/done/ATV-065-remove-fake-receiving-data.md`.
- **Compact Gautos partijos filters (ATV-066)** — four-column desktop filter
  grid in the required order, natural-width reset aligned to row two, mobile
  wrapping without horizontal scroll, and reset visibility derived from active
  filters (including `Visos` alone) with session restoration. Screenshots in
  `docs/screenshots/atv-066/`; record:
  `tasks/done/ATV-066-compact-gautos-partijos-filters.md`.
- **Compact batch header, type-specific confirmation, receipt expenses and
  expense-aware valuation (ATV-067)** — the batch page shows
  `Priėmimas GYYMM-NN / PXX` once with a compact status/date/supplier/resource/
  warehouse/actual-quantity row and the `Priėmimo GYYMM-NN išlaidos` /
  `Redaguoti partiją` actions. Confirmation renders one field chosen from the
  stored mode (`Dokumentinis svoris, kg` for WEIGHT; PIECE offers itemised
  per-product entry `Pagal prekes` or one `Dokumentinis kiekis, vnt.` total for
  documents with only a total) with a same-unit comparison and `—` for empty
  input. Transport and customs are one shared `IncomingDeliveryExpense` per
  `Priėmimas` (`Pagal vertę` / `Po lygiai`, cent-exact allocation; mixed receipts
  only equal at ATV-067, later extended by ATV-072), frozen per batch at
  confirmation and added to dashboard stock value
  once; later edits warn about an unallocated balance instead of rewriting
  confirmed shares. Receipts without expenses keep acquisition-only valuation.
  Integration suite, screenshots (`docs/screenshots/atv-067/`) and docs updated.
  Record: `tasks/done/ATV-067-receiving-header-expenses-and-valuation.md`.
- **Single receiving list, unfinished receipts and parent navigation (ATV-068)** —
  `/receipts` is the only receiving list; `/receiving` redirects there, while
  `/receiving/new` stays a record-free form and the receipt/batch routes remain.
  The list shows `Pradėti priėmimai be partijų` only while zero-batch started
  receipts exist, each with `Tęsti priėmimą`; adding the first batch moves the
  receipt into `Gautos partijos`. Every `Priėmimų sąrašas` action returns to
  `/receipts` with the operator's filters restored, including after a direct
  editor link. The batch editor's parent action is `Redaguoti priėmimą` while
  editable or `Peržiūrėti priėmimą` when read-only, opens the exact parent
  receipt, and the `Priėmimas G…` heading appears once. The `G2611-02`/`G2611-03`
  trace and isolated creation-flow reproduction are recorded in the task record;
  live records were preserved. Screenshots in `docs/screenshots/atv-068/`.
  Record: `tasks/done/ATV-068-receiving-navigation-and-empty-receipts.md`.
- **Batch-less receipt rows and protected deletion (ATV-069)** — the separate
  `Pradėti priėmimai be partijų` block was removed. `Gautos partijos` merges
  normal batch rows with one row per zero-batch receipt in `Visos`; `Reikia
  patvirtinti`/`PENDING`/`CONFIRMED` show only matching batches. Empty rows show
  `Be partijų`, use `—` for batch-specific values, and link the receipt code to
  the receipt editor. Supplier/date filters apply to both; resource/warehouse/
  batch-code filters exclude empty receipts. Eligible rows offer
  `Ištrinti priėmimą` with a code-specific `Atšaukti`/`Ištrinti` dialog, toast,
  filter retention and refresh. The API locks the delivery row, rejects batches
  (`DELIVERY_HAS_BATCHES`) and non-zero expenses (`DELIVERY_HAS_EXPENSES`), and
  allows zero-amount expense records. Screenshots in
  `docs/screenshots/atv-069/`; record:
  `tasks/done/ATV-069-batch-less-receipts-and-deletion.md`.
- **Receipt list, per-receipt manager confirmation and revisable expenses
  (ATV-070)** — `/receipts` is a receipt list (`Priėmimai`) with one row per
  receipt, confirmation counts, derived status, supplier/date and once-per-receipt
  batch filters, plus pagination after grouping. The ADMIN manager screen
  `/receipts/[deliveryId]` confirms individual P… batches with `Priimta`,
  `Dokumentuose`, `Skirtumas`, acquisition value and the itemised/total PIECE
  forms. Receipt expenses are previewed and applied per receipt through an
  append-only application ledger; late invoices/revisions update confirmed
  valuations by the difference only, reapply is a no-op, and pending shares
  enter on confirmation. Worker screens and batch reads no longer expose
  acquisition/expense data. Screenshots in `docs/screenshots/atv-070/`; record:
  `tasks/done/ATV-070-receipt-list-manager-screen-and-expense-revisions.md`.
- **Receipt status filter and distinct receipt/action destinations (ATV-071)** —
  the `Būsena` filter is exactly `Laukia patvirtinimo` (default, including
  partially confirmed receipts), `Patvirtinta` and `Visos`; legacy
  `NEEDS_CONFIRMATION` values map to the new default while other filters are
  preserved. On `/receipts`, the G… number always opens the operational
  `/receiving/[deliveryId]` page for every status/role; `Tvirtinti` (pending) and
  `Peržiūrėti` (fully confirmed) open `/receipts/[deliveryId]` only for managers.
  Workers see no manager actions but retain operational batch/label access.
  Keyboard activation of the receipt number follows its own link. Screenshots in
  `docs/screenshots/atv-071/`; record:
  `tasks/done/ATV-071-receipt-status-filter-and-distinct-destinations.md`.
- **PIECE entry layout/search, read-only confirmed receiving and mixed acquisition
  allocation (ATV-072)** — the PIECE form uses two aligned desktop rows (`Prekė`
  widest, equal control heights, `+ Nauja prekė` under the product selector, save
  actions right-aligned) and a searchable product selector that stores the existing
  product ID. Fully confirmed operational receipts are read-only (no `Nauja
  partija`, no confirmed-batch edit controls, `Spausdinti` retained), partially
  confirmed receipts keep pending batches editable, and direct confirmed-batch
  URLs render read-only while server checks stay authoritative. Mixed kg/vnt.
  `Pagal vertę` now allocates by recorded acquisition value in EUR when every
  eligible batch has a value and the total is positive; a recorded `0,00 €` is a
  valid zero share, a missing value names the batch and keeps `Po lygiai`, and an
  all-zero basis is explained. Preview/apply share one calculation, allocate
  transport/customs separately to the cent, show acquisition values, and record
  only valuation differences on revision. Screenshots in
  `docs/screenshots/atv-072/`; record:
  `tasks/done/ATV-072-piece-entry-readonly-and-mixed-allocation.md`.
- **Unmistakable manager batch grouping and confirmation (ATV-073)** — the
  manager receipt screen now renders each batch as its own continuous bordered
  group; an expanded multi-product PIECE batch shows a compact outlined
  `Rodyti prekes` / `Slėpti prekes` toggle with a chevron and focus ring, a
  `PXX prekės` heading and a muted panel, while the next batch starts outside the
  border. Each pending batch has exactly one code-labelled action
  (`Patvirtinti P01`): on the summary row when collapsed, at the bottom-right
  after the inputs when expanded. The discrepancy dialog names the same batch.
  Confirmed groups stay read-only. Screenshots in `docs/screenshots/atv-073/`;
  record: `tasks/done/ATV-073-manager-batch-grouping-and-confirmation.md`.
- **Required-field highlighting and aligned manager toggles (ATV-074)** — expanding
  a pending batch immediately marks each empty/invalid required manager input with
  a red border and `aria-required`/`aria-invalid`: WEIGHT documentary weight and
  acquisition, each PIECE `Pagal prekes` product independently, or the single
  `Bendras kiekis` total. Values clear/restore the border using the same rules as
  confirmation; `0` is accepted where the rule allows it, and optional document
  date/number stay neutral. `Dokumento duomenys` now sits below `Prekė` with the
  same outlined chevron toggle as `Rodyti prekes`, with one toggle per batch.
  Summary columns align with their headings, and `Būsena / veiksmas` contains only
  the status or `Patvirtinti PXX`. Screenshots in `docs/screenshots/atv-074/`;
  record: `tasks/done/ATV-074-required-field-highlighting-and-toggle-alignment.md`.
- **Receiving workflow inventory before redesign (ATV-075)** — documentation-only
  reproducible baseline of the receiving workflow at the uncommitted ATV-066…074
  tree: branch/HEAD/status plus a 108-file SHA-256 fingerprint (aggregate
  `74332527…156dc4`), a UI-inward route/role/scenario walk, a code-outward API
  map including direct-URL-only pages and endpoints with no web caller, 118
  stable-ID inventory rows (`RCV-*`) covering receipt/batch lifecycle, physical
  WEIGHT/PIECE receiving, labels, documentary confirmation, discrepancies,
  settlements, acquisition/expenses/allocation, stock valuation and measurement
  mode, a calculation register, and 29 classified findings. Re-run procedure in
  `docs/audits/receiving-inventory-method.md`; inventory in
  `docs/audits/receiving-inventory-before.md`; record:
  `tasks/done/ATV-075-receiving-inventory-before-redesign.md`. No application,
  schema or live data changed.

## CURRENT

- **Ten uncommitted changes awaiting human review:** ATV-066 (compact filters),
  ATV-067 (batch header, type-specific confirmation, expenses, valuation),
  ATV-068 (single receiving list + parent navigation), ATV-069 (batch-less rows
  + deletion), ATV-070 (receipt list, manager screen, revisable expenses),
  ATV-071 (status filter + distinct destinations), ATV-072 (PIECE entry
  layout/search, read-only confirmed receiving, mixed acquisition allocation),
  ATV-073 (manager batch grouping + code-labelled confirmation), ATV-074
  (required-field highlighting + toggle alignment) and ATV-075 (documentation-only
  receiving inventory baseline). No
  functional scope beyond confirmed requirements was added; stock balances,
  movements, purchasing/accounting, production, orders and sales remain
  unconfirmed.

## NEXT (only with a confirmed requirement)

1. Human review and commit of ATV-066…075.
2. Any new functional scope — **none confirmed**. Requires a confirmed
   requirement and a new task; do not infer from `/sandelys`.

## LATER / DISCOVERY ONLY (not approved, do not build)

The items below come from legacy discovery. They are **unconfirmed** and must
not be promoted into current/next work:

- stock balances and warehouse movements (the dashboard summary is only a
  read-only projection), inventory lots, catalog, units;
- orders, order lines, dispatch/sales;
- discrepancies/errors, barcode workflows, reporting;
- Sandėlys integration/adapter, data migration, synchronisation;
- tenant/company architecture; background processing; observability; deployment.

See `docs/first-slice-readiness.md` (candidate slices; **none selected**) and
`docs/data-ownership.md` (ownership matrix; **no ownership decided**). Any move
to build one of these starts with a confirmed requirement and a recorded task,
and must follow `docs/legacy-as-reference.md` (ADR-004).

## Open questions (do not answer without evidence)

- Business answers on ownership/write authority
  (`docs/business-decisions.md`, workspace O-036) — unrelated to identity but
  required before any future data scope.
- Which Sandėlys instance(s) are canonical (workspace O-021).
