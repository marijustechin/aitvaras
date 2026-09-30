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
  list + read-only detail. No stock, packing-form link, status lifecycle,
  accounting or `PATCH`/`DELETE`. Auth: authenticated (not ADMIN) for
  list/read/create. Docs: `receipts.md`, `domain-glossary.md`.
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
  unique code (`P-<year>-<sequence>`), arrival date and `PENDING` status;
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

## CURRENT

- **Uncommitted work:** batch ↔ GoodsReceipt reconciliation (ATV-030), the
  warehouse-worker receiving UI (ATV-031), handling-unit quantities + required
  location + labels (ATV-032), the save→label surface flow (ATV-033), the batch
  units list (ATV-034), the split save action + icons (ATV-035), the pointer
  cursor convention (ATV-036), the ADMIN reconciliation boundary cleanup
  (ATV-037), the `Gavimai` admin queue (ATV-038), the `Gavimai` row
  interaction/status colours (ATV-039), the `Gavimai` detail links/confirmation
  wording (ATV-040) and the filter reset + physical unit correction/void
  (ATV-041) — implemented and awaiting review/commit.
- The partner/resource/receipt relationship beyond the recorded fields is not
  designed. No further business scope is confirmed; stock balances, warehouse
  movements, purchasing/accounting, production, orders and sales remain
  unconfirmed.

## NEXT (only with a confirmed requirement)

1. Verify, commit and push the ATV-020…ATV-026 (O-058…O-064) package — tracked
   as workspace backlog **O-068**.
2. Any new functional scope — **none confirmed**. Requires a confirmed
   requirement and a new task; do not infer from `/sandelys`.

## LATER / DISCOVERY ONLY (not approved, do not build)

The items below come from legacy discovery. They are **unconfirmed** and must
not be promoted into current/next work:

- inventory / stock lots, locations, catalog, units;
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
