# Legacy Workflows — `/sandelys`

> **Status: discovery only — NOT an approved roadmap.** See `scope.md`. These
> workflows are legacy evidence, not confirmed Aitvaras requirements.

> Workflows traced from `/sandelys` code (branch `alfasis-next`, based on
> `master` `5b4c639`). Each flow is written as
> `trigger → inputs → business rules → DB changes → logs/audit → outputs`.
>
> **Observed** = directly in code. **Inferred** = reasoned but unconfirmed.
> **Unknown** = requires business confirmation. Code is not a specification
> (ADR-001); these flows are domain evidence, not Aitvaras requirements.

Primary actor roles (see `app/User.php`): 1 Admin, 2 Warehouse worker,
3 Manufacturing manager, 4 Read-only, 5 Accountant, 6 Operations manager.
Barcode input can be one or many values separated by `, . tab newline space`
(`HomeController::splitBarcodes`).

---

## 1. Stock registration (warehouse)

`GET stock/create-warehouse` → `POST stock/store` (`store_type=warehouse`)

- **Trigger:** warehouse worker receives goods.
- **Inputs:** warehouse place, supplier, storage location, stock type, weight,
  pieces.
- **Rules:** authorize `manageWarehouse` (admin/warehouse/accountant);
  all fields required; weight numeric `max:8`; pieces integer; the chosen
  location must belong to the chosen place.
- **DB changes:** insert `stocks` (`status_id=1`, `user_id`=actor), then set
  `barcode` from the new id and save again. Defaults (place/supplier/location/
  type) are remembered in the session.
- **Logs/audit:** no explicit `stock_logs` row; an `audits` create row is
  produced by Laravel Auditing.
- **Outputs:** redirect to stock detail page; barcode is printable there.
- **Unknown:** exact physical receiving process, label stock, whether weight is
  always entered.

## 2. Stock registration (warehouse, from manufacturing)

`GET stock/create-warehouse-from-manufacturing` → `POST stock/store`
(`store_type=warehouse-from-manufacturing`)

- **Trigger:** packed/manufactured output is booked into a warehouse.
- **Inputs:** destination warehouse place, source place (sorting/packing),
  location, type, weight, pieces.
- **Rules:** same as §1 but no supplier input; supplier is forced to **id 1**
  `(iŠ vidaus)`; source place must be a manufacturing place.
- **DB changes:** insert `stocks` (`status_id=1`), generate barcode; insert a
  `stock_logs` row with the **source** place and `status_id=4` (packing).
- **Logs/audit:** explicit `stock_logs` + `audits`.
- **Outputs:** stock detail page.

## 3. Stock registration inside manufacturing

`GET stock/create-manufacturing` → `POST stock/store`
(`store_type=manufacturing`)

- **Trigger:** manufacturing worker creates an internal lot.
- **Inputs:** source place (sorting), destination place (packing), type, weight.
- **Rules:** authorize `manageManufacturing` (admin/manufacturing manager);
  supplier forced **1**; `location_id=null`; `pieces=1`.
- **DB changes:** insert `stocks` with `status_id=4`, **no barcode** (the
  barcode line is commented out); insert a `stock_logs` row with the source
  place and `status_id=3` (sorting).
- **Logs/audit:** explicit `stock_logs` + `audits`.
- **Outputs:** stock list.
- **Note:** manufacturing-created stock has `parent_id=null` and no barcode, so
  it is not reachable via the home barcode box until later.

## 4. Barcode generation

- **Trigger:** warehouse stock is created (or edited? no — only on create).
- **Rule (observed, `StockController::makeBarcode`):** an 11-character numeric
  string built from `date('y')` + zero-padded day-of-year, then the trailing
  characters are replaced by the stock `id`. Effective shape: date prefix +
  zero padding + per-instance id.
- **Uniqueness:** `stocks.barcode` is indexed but **not unique**; the original
  `unique()` was removed (migration comment). Duplicate barcodes are expected
  (parent/child partial lots and manufacturing outputs share a parent barcode).
- **Rendering:** `milon/barcode` `DNS1D` produces PNGs for C93 and C39 on the
  stock detail page.
- **Aitvaras note:** barcodes encode legacy per-instance ids and creation dates;
  they are **not** a reliable unique key (see `identity-strategy.md`).

## 5. Stock lookup / show

`POST /home/handle-action` (`action=show`) → `GET stock/{id}`

- **Trigger:** entering one barcode on the home screen.
- **Rules:** barcode required, numeric, must exist in `stocks`; authorize
  `show` (admin/warehouse/read-only; manufacturing only for statuses 3–4;
  accountant only for `accountant_places`).
- **DB changes:** none.
- **Outputs:** stock detail page with movement history (`stock_logs`), current
  place/status/supplier/type, and printable barcodes.
- **Caveat:** `->first()` is used, so when a barcode matches multiple lots
  (duplicates) the shown lot is arbitrary.

## 6. Stock search

`POST /home/handle-action` (`action=search`) → `GET stock/search`

- **Trigger:** entering a partial barcode.
- **Rules:** numeric; returns up to **20** non-sold stocks ordered by
  `updated_at desc`, with place/supplier/location/status/type.
- **DB changes:** none.
- **Outputs:** search result list; if empty, redirect home with a warning.

## 7. Warehouse → manufacturing transfer

`GET stock/transfer-warehouse` → `PUT stock/store-transfer`
(`store_type=warehouse`)

- **Trigger:** scanning warehouse stock to send to sorting/packing.
- **Inputs:** destination manufacturing place + barcode.
- **Rules:** stock must currently be `status_id=1`; destination must be a
  sorting/packing place; status derived from destination type (2→3, 3→4).
- **DB changes:** insert `stock_logs` snapshot of the **old** place/status,
  then update `stocks.place_id`/`status_id`/`user_id`.
- **Logs/audit:** `stock_logs` + `audits`.
- **Mass variant:** `stock/mass-transfer-warehouse` handles a list of barcodes
  in a loop (no per-item status validation in the mass path).

## 8. Manufacturing internal (sorting → packing)

`GET stock/edit-manufacturing/{stock}` → `PUT stock` (`store_type=manufacturing`)

- **Trigger:** editing a lot inside manufacturing.
- **Rules:** if current status 3 (sorting) require a place; if status 4
  (packing) require source and destination places; weight numeric.
- **DB changes:** update stock place/type/weight (`pieces=1`); when weight
  changed, insert a `stock_logs` snapshot first; when status 4, also rewrite the
  latest log row's place/weight/pieces.
- **Note:** manufacturing **edit** rewrites an existing log row (not strictly
  append-only).

## 9. Manufacturing → warehouse return

`GET stock/transfer-manufacturing` → `PUT stock/store-transfer`
(`store_type=manufacturing`)

- **Trigger:** returning sorted/packed lots to the warehouse.
- **Rules:** stock status must be 3 or 4; destination must be a warehouse place;
  sets stock status **1 directly** (no transit state).
- **DB changes:** insert `stock_logs` snapshot; update stock place/status/user.
- **Mass variant:** `stock/mass-transfer-manufacturing` loops barcodes.

## 10. Warehouse ↔ warehouse transfer

Two modes controlled by `APP_DIRECT_TRANSFER` (`config('app.direct_transfer')`):

- **Transit mode (default):** `stock/transfer-warehouse-to-warehouse` sets the
  stock's destination place and `status_id=5` (“in transit to warehouse”).
  Receiving is a separate step.
- **Direct mode:** the home action redirects straight to the receive screen;
  receive accepts statuses 1 or 5.
- **Rules:** source stock must be status 1; destination must differ from the
  current place; destination must be a warehouse place.
- **DB changes:** `stock_logs` snapshot; update place/status(5)/user.
- **Mass variant** exists and reports per-barcode errors inline.

## 11. Receive (warehouse-to-warehouse)

`GET stock/receive-warehouse-to-warehouse` → `PUT stock/store-receive`

- **Inputs:** destination warehouse place, storage location, barcode.
- **Rules:** location must belong to the place; in transit mode stock must be
  status 5, in direct mode statuses 1/5; reject if already there.
- **DB changes:** `stock_logs` snapshot; update place/location/status(1)/user.
- **Mass variant:** `stock/store-mass-receive`.

## 12. Partial transfer (split a lot)

`PUT stock/store-transfer` with `partial=1`

- **Trigger:** moving part of a lot (weight or pieces) to manufacturing.
- **Rules:** operate on the **parent** (`parent_id=null`); parent must be
  status 1; provided pieces (or weight) must be **strictly less** than the
  parent's; if pieces omitted it becomes 0→stored as 1 for the child.
- **DB changes:** create a **child** stock with `parent_id=parent.id`, the
  **same barcode**, its own place/status/type/weight/pieces; log the child's
  initial state, log the parent's prior state, then decrement parent
  pieces/weight.
- **Consequence:** barcode now refers to a lineage; later scans can match
  parent and children.
- **Unknown:** how the floor staff choose parent vs child, and how duplicates
  are resolved in practice.

## 13. Orders — create & define lines

- **Create:** `order/create` → `order/store` — name (free text), buyer; status
  defaults to 1. `user_id` = actor.
- **Define expected lines:** `order-stock/{order}/edit` → `order-stock/{order}`
  update — the controller **deletes all existing `order_stock_types` for the
  order and re-inserts** the submitted type/weight/price rows. Admin/read-only
  can edit prices (`orderStockPrices`).
- **Statuses:** `Renkamas` (1), `Surinktas` (2), `Atkrautas` (3).

## 14. Order collection

`POST /home/handle-action` (`action=collect-order`) → `order-collect/create` →
`POST order-collect/store`

- **Trigger:** scanning warehouse stock to assign it to an order.
- **Rules:** each barcode must be status 1 and **not already assigned** to an
  order; only status-1 orders are selectable.
- **DB changes:** set `stocks.order_id` for each scanned stock. No `stock_logs`
  row is written for collection itself.
- **Outputs:** order detail page showing collected vs needed weight per type.

## 15. Order completion state

- `order-collect/mark-completed/{order}` → status 2.
- `order-collect/mark-uncompleted/{order}` → status 1.
- `order-collect/clear/{order}` → clears all `stocks.order_id` and status 1
  (only if not already 3).
- `order-collect/clear-one/{order}/{stock}` → clears one assignment.

## 16. Order sell (full dispatch)

`order-collect/sell/{order}`

- **Rules:** order not already status 3.
- **DB changes:** for each stock in the order: insert `sales` row
  (`buyer_id` = order buyer, `user_id` = actor), insert `stock_logs` snapshot,
  set stock `status_id=6`. Set order `status_id=3`.
- **Outputs:** order detail page.

## 17. Partial sale (split an order) — newest feature

`order-collect/partial-sale/{order}` (order must be status 2) →
`POST order-collect/partial-sale/{order}`

- **Inputs:** one or more barcodes (must belong to this order) and a choice:
  move selected stock to a **new order copy** or just **remove** them.
- **Rules (observed):** barcodes must exist in the order; runs in a
  `DB::transaction`; if “move to new”, replicates the order + its stock types
  into a new order (`name + ' kopija'`) and reassigns selected stocks; then the
  **remaining** stocks of the original order are sold (sale + log + status 6)
  and the original order becomes status 3.
- **Unknown:** exact business intent/usage frequency; the sibling UI semantics
  need confirmation (`PCTODO test this and remove` comment in code).

## 18. Sales / dispatch (`atkrovimai`)

- **Single:** `sale/create` → `sale/store` — buyer + barcode; stock must be
  status 1; insert `sales`, insert `stock_logs`, set stock status 6.
- **Mass:** home action `register-sale` validates barcodes are status 1, then
  `sale/mass-create` → `sale/mass-store` loops barcodes and creates a sale per
  stock (no per-item status re-check in the mass store).
- **Edit:** buyer can be changed; stock status/log untouched.
- **Delete:** `sale/destroy` deletes the **latest** `stock_logs` row, resets
  stock to status 1 and `order_id=null`, deletes the sale.

## 19. Corrections

- **Remove sale (home action `remove-sale`):** for status-6 stock, delete the
  latest `stock_logs` row, set status 1 / `order_id=null`, delete the sale.
- **Clear sold stock from a sold order** (`order-collect/clear-sale/{order}/{stock}`):
  deletes the latest log, sets status 1, deletes the sale.
- **Delete stock** (`stock/destroy`): hard delete of the `stocks` row
  (authorize `delete`, admin+owner only). No explicit log cleanup in this path,
  so FK behaviour on logs applies.
- **Edit transfer/receive** (`stock/edit-transfer`, `stock/edit-receive`):
  update the stock's place directly; note `updateTransfer` uses an assignment
  bug (`elseif ($stock->status_id = 5)`) that mutates status on GET
  (`TransferController::editTransfer`) — **observed bug**, not a rule.
- Important: corrective flows **mutate/delete history**, so legacy history is
  not guaranteed append-only.

## 20. Sorting/packing errors (`stock_errors`)

- `stock-error/create` → `stock-error/store`; inputs sorting place, packing
  place, type, weight. Records who/when/what weight discrepancy.
- **Unknown:** review process and downstream (payroll/accounting) use.
- **Inferred:** manufacturing manager/accountant use it (policy `workWith`).

## 21. Reports

`/report/*` behind the `reports` middleware (role-dependent). Eleven screens
(`Admin\ReportController`): general, places, places-only-types, place-groups,
stock-residual, stock-residual-no-order, sales, orders, stock-delivered,
suppliers. `APP_REPORT_CALCULATION` selects weight vs container-based sums.
- **Unknown:** which reports are actually used, by whom, how often, and what
  decision each supports (workspace backlog O-005). Treat as unvalidated.

## 22. Authentication & authorization

- **Auth:** session login via `Auth::routes()`; `login` is the unique
  credential (email disabled); users have exactly one `role_id`;
  `disabled` flag exists.
- **Authorization:** per-model policies + route middleware `admin`, `reports`;
  `CheckIp` middleware can block users by `users.allowed_ips` when `CHECK_IP`
  is enabled (main instance on; `lt`/`ltn` off).
- **Role scoping examples:** stock lists filtered by role and `accountant_places`;
  read-only sees prices; operations manager (6) does not.

## 23. Destructive operation (not scheduled)

- `sandelys:dalete-data {date-till}` (`app/Console/Commands/DeleteData.php`)
  force-deletes stocks (status 2/3/4/6), stock errors and empty orders before a
  date, inside a transaction. Confirmed **not scheduled** in production, but it
  exists and is dangerous. No Aitvaras analogue should be designed casually.

---

## Cross-cutting observations for Aitvaras

1. **Status/lifecycle is controller-encoded**, not centralised; Aitvaras should
   formalise explicit state transitions.
2. **History is deletable**; Aitvaras should design append-only history.
3. **Barcode is a lineage key**, not a unique key.
4. **Collection/dispatch is not transactional** in the legacy mass paths.
5. Several flows are **deprecated/commented** (receive-warehouse,
   receive-manufacturing, status 2, order stock create). Do not treat them as
   current requirements.
6. **Business confirmation is required** for receiving, error handling, report
   usage, partial sale, and whether status 2/transit states are used.

## Related documents

- `docs/legacy-domain-map.md`
- `docs/identity-strategy.md`
- `docs/data-ownership.md`
- `docs/integration-boundaries.md`
- Workspace: `../../docs/business/known-workflows.md`,
  `../../docs/business/barcode-printing-flow.md`
