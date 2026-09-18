# Data Ownership — Aitvaras ↔ Sandėlys

> **Status: decision-preparation only — NOT an approved roadmap.** See
> `scope.md`. No ownership has been decided; every future-owner entry is a
> proposal or an open business question.

> Decision-preparation document (O-035). It distinguishes **facts** (observed
> legacy behaviour), **proposals** (agent recommendations needing review) and
> **decisions** (made only by the human/business owner).
>
> Status vocabulary:
> **confirmed** · **proposed** · **business decision required** ·
> **not needed** · **deferred**.
>
> Rules that constrain any answer here are in `transition-model.md` and
> ADR-005. The recommended boundary is ADR-003. The project-wide rule that
> legacy is evidence, not specification, is ADR-004 /
> `legacy-as-reference.md`. Identity handling is in `identity-strategy.md`.
> No business answers are invented in this document.

## 1. Observed current ownership (facts)

Read directly from `/sandelys` (see `legacy-domain-map.md`). This is what is
true **today**, not a proposal.

| Concept | System of record today | Notes |
|---|---|---|
| Inventory / stock lots | Sandėlys `stocks` | mutable in place; status-driven; per-instance ids |
| Stock movement history | Sandėlys `stock_logs` (+ `audits`) | corrective flows delete recent log rows |
| Locations / places | Sandėlys `places`/`place_types`/`place_groups`/`locations` | per-instance; place `40` hardcoded |
| Product/type/category dictionaries | Sandėlys `stock_types`/`stock_categories`/`containers` | seeded; partly shared vocabulary |
| Suppliers | Sandėlys `suppliers` | per-instance; `id=1` `(iš vidaus)` default |
| Buyers | Sandėlys `buyers` | per-instance |
| Countries | Sandėlys `countries` | shared seed; ISO-like ids |
| Orders / order lines | Sandėlys `orders`/`order_stock_types` | free-text `name`; no order number |
| Dispatch / sales | Sandėlys `sales` | `atkrovimai`; created from orders and scans |
| Discrepancies / errors | Sandėlys `stock_errors` | meaning (payroll?) unconfirmed |
| Users | Sandėlys `users` | per-instance; `login` credential |
| Roles / permissions | Sandėlys seeded roles + controller/policy code | six roles; code-level rules |
| Barcode | Sandėlys (generated, non-unique) | date+id; lineage key |
| Audit / history | Sandėlys `audits` + `stock_logs` | two overlapping mechanisms |
| Tenant/company/site | **implicit** in the deployment (one DB per instance) | not an explicit entity anywhere |

## 2. Ownership decision matrix

Columns: **SoR now** = current system of record; **Aitvaras needs?**; **future
owner options**; **transition mode (proposed)** (vocabulary in
`transition-model.md`); **status**.

| # | Concept | SoR now | Aitvaras needs? | Future owner options | Transition mode (proposed) | Status |
|---|---|---|---|---|---|---|
| 1 | Inventory / stock lots | Sandėlys | Yes | Aitvaras (long-term) | Read-through → Migration | business decision required |
| 2 | Locations / places / groups | Sandėlys | Yes | Aitvaras (long-term) | Mirrored reference data → Migration | business decision required |
| 3 | Product/type/category dictionaries (+ containers) | Sandėlys | Yes | Aitvaras | Mirrored reference data | proposed |
| 4 | Suppliers | Sandėlys | Yes | Aitvaras (long-term) | Mirrored reference data → Migration | business decision required |
| 5 | Buyers | Sandėlys | Yes | Aitvaras (long-term) | Mirrored reference data → Migration | business decision required |
| 6 | Orders | Sandėlys | Yes | Aitvaras (long-term) | Read-through → Migration | business decision required |
| 7 | Order lines | Sandėlys | Yes | Aitvaras (long-term) | Read-through → Migration | business decision required |
| 8 | Dispatch / sales | Sandėlys | Yes | Aitvaras (long-term) | Read-through → Migration | business decision required |
| 9 | Discrepancies / errors | Sandėlys | Unknown | unknown | Legacy-only **or** Retired | deferred |
| 10 | Users | Sandėlys | Yes | Aitvaras (new identities) | Aitvaras-owned (legacy-only for attribution) | proposed |
| 11 | Roles / permissions | Sandėlys | Yes (needs) | Aitvaras | Retired (redesign as Aitvaras-owned) | proposed |
| 12 | Barcode semantics | Sandėlys | Yes | Aitvaras (new scheme) + legacy read-through | Read-through (legacy) + Aitvaras-owned (new) | business decision required |
| 13 | Audit / history | Sandėlys | Yes | Aitvaras (new mechanism) | Aitvaras-owned; legacy read-only | proposed |
| 14 | Tenant / company / site (net-new) | none (implicit) | Yes if multi-instance | Aitvaras | Aitvaras-owned | business decision required |

**Reading the matrix:** a `proposed` status is an agent recommendation, not a
decision. Anything marked `business decision required` is blocked on the owner.
`deferred` means evidence is insufficient (concept may be inactive).

## 3. Per-concept decision detail

For each concept: **read authority**, **write authority**, **migration
requirement**, **synchronization requirement**, **risk if ownership is split**,
**unresolved business question**. All future-facing statements are proposals.

### 1. Inventory / stock lots
- **Read:** Likely required during transition (current lot state, location).
- **Write:** **No** Aitvaras → Sandėlys writes. Aitvaras may become the writer
  for **new** lots only after a business decision.
- **Migration:** Likely for open lots at cutover; closed/historical lots
  optional.
- **Sync:** None initially; if mirrored, one-way legacy→Aitvaras with
  reconciliation (deletes are not observable in legacy).
- **Split-ownership risk:** **High** — two writers of the same lot create
  divergent physical state and irreconcilable history.
- **Question:** Once Aitvaras is live, where are new stock lots registered?
  Does Sandėlys ever still create lots?

### 2. Locations / places / place groups / storage locations
- **Read:** Yes.
- **Write:** None. Aitvaras owns layout only after migration.
- **Migration:** Yes — physical layout is instance-specific.
- **Sync:** Mirror is sufficient while stable; reconcile on layout changes.
- **Split-ownership risk:** Medium — mismatched place identity breaks transfers.
- **Question:** Is the physical place layout the same across the seven
  instances, or tenant-specific?

### 3. Product/type/category dictionaries (+ containers)
- **Read:** Yes.
- **Write:** None initially.
- **Migration:** Yes (small, mostly stable).
- **Sync:** Mirror; occasional refresh.
- **Split-ownership risk:** Low–medium — divergent type codes confuse reporting.
- **Question:** Are type/category names and container tare weights identical
  across instances? (Note: container tare (0.8/0.2 kg) affects reports.)

### 4. Suppliers
- **Read:** Yes.
- **Write:** None initially.
- **Migration:** Likely for active suppliers.
- **Sync:** Mirror/reconcile; partners change rarely.
- **Split-ownership risk:** Medium — same supplier duplicated under two systems.
- **Question:** Are current supplier records authoritative and clean enough to
  migrate?

### 5. Buyers
- As suppliers; buyers are per-instance and operational.
- **Question:** Are buyers per tenant, or shared across companies?

### 6. Orders
- **Read:** Yes during transition.
- **Write:** None initially.
- **Migration:** Open orders at cutover are the key scope question.
- **Sync:** Read-through is safer than mirroring mutable orders.
- **Split-ownership risk:** **High** — an order modified in both systems cannot
  be reconciled deterministically.
- **Question:** At cutover, are open orders finished in Sandėlys or moved to
  Aitvaras?

### 7. Order lines
- Follows orders. Legacy lines are delete-and-reinsert and carry
  weight/price; Aitvaras should model lines explicitly.
- **Question:** Must expected weights/prices be preserved for historical orders?

### 8. Dispatch / sales
- **Read:** Yes; likely needed for accounting/history.
- **Write:** None initially.
- **Migration:** Likely for audit/accounting; scope of history undecided.
- **Sync:** Read-through/mirror for reporting only.
- **Split-ownership risk:** **High** — dispatch is the financial event.
- **Question:** Is historical dispatch data required in Aitvaras, and for how far
  back?

### 9. Discrepancies / errors
- **Read/Write:** Unknown.
- **Migration:** Deferred.
- **Question:** Are `stock_errors` still actively used, and do they affect pay?

### 10. Users
- **Read:** Possibly, for attribution of imported history.
- **Write:** Aitvaras owns its own users; **never migrate passwords**.
- **Migration:** **No** (credentials must not be reused). Legacy user identity
  may be mapped read-only for attribution.
- **Sync:** None.
- **Split-ownership risk:** Low for business data; login/identity is Aitvaras's.
- **Question:** Who administers Aitvaras users, and is single sign-on expected?

### 11. Roles / permissions
- **Read:** To understand real needs.
- **Write:** Aitvaras owns permissions.
- **Migration:** No — redesign from confirmed needs (legacy rules are code-level
  and some are questionable).
- **Question:** Which of the six legacy roles reflect real staffing, and what
  should each be allowed to do?

### 12. Barcode semantics
- **Read:** Yes — old barcodes should keep resolving operationally (question).
- **Write:** Aitvaras generates new barcodes only once it owns stock.
- **Migration:** As an **attribute/lineage**, not identity.
- **Sync:** None.
- **Split-ownership risk:** **High** if two systems generate overlapping
  barcodes for the same physical world.
- **Question (central):** Does a barcode represent **identity**, **lineage**, or
  only a **printable operational reference**? Must old barcodes resolve forever?

### 13. Audit / history
- **Read:** Possibly for forensics/import.
- **Write:** Aitvaras owns a new append-only history.
- **Migration:** Optional subset (recent movements); legacy history is
  deletable, so it is not a trustworthy audit source.
- **Sync:** None (except a one-time import if required).
- **Question:** Is historical movement data required in Aitvaras?

### 14. Tenant / company / site (net-new)
- **Read:** From deployment configuration, not legacy data (implicit today).
- **Write:** Aitvaras.
- **Migration:** No source entity exists; may need mapping from instance id.
- **Question:** Is Aitvaras single-tenant first or multi-instance, and must
  tenant/company/site be explicit? (See `business-decisions.md`.)

## 4. Ownership principles (proposed)

1. **Aitvaras owns Aitvaras data.** New entities created in Aitvaras are owned
   by Aitvaras regardless of legacy state.
2. **Sandėlys remains system of record during transition** for concepts the
   business still operates there. Aitvaras must not write to Sandėlys until a
   recorded decision grants write authority per concept.
3. **Ownership moves one concept at a time**, with its own decision and
   migration plan — never wholesale.
4. **Reference dictionaries vs transactional data** are treated differently:
   small dictionaries are low-risk to mirror; stock/orders/sales are high-risk
   and require confirmed ownership and migration strategy.
5. **Identifiers do not move as-is** (`identity-strategy.md`).

These are constrained by the write-authority rules in `transition-model.md`
(ADR-005).

## 5. Business decisions outstanding

The questions that unlock this matrix are consolidated, in business language, in
`business-decisions.md`. Nothing here is decided until the owner answers.

## 6. Related documents

- `transition-model.md` — transition vocabulary and write-authority rules
- `business-decisions.md` — the questionnaire (and instance scope)
- `first-slice-readiness.md` — what each candidate slice is blocked on
- `legacy-domain-map.md`, `legacy-workflows.md`, `identity-strategy.md`
- `integration-boundaries.md`, `legacy-as-reference.md`, `architecture.md`
- ADR-003 (proposed), ADR-004 (accepted), ADR-005 (accepted), ADR-006 (proposed)
