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

- one resource entity with exactly one category (`Žaliava`, `Pusgaminis`,
  `Gaminys`), a required name, optional notes and an active/inactive lifecycle;
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

**Not** confirmed (still out of scope): purchasing/accounting, supplier
invoices, payments, stock balances, warehouse **movements**, quantities on
hand, production, orders and sales.

### Confirmed initial roles

`ADMIN`, `WAREHOUSE_WORKER`, `ACCOUNTING`, `PRODUCTION_MANAGER`.

Roles are configuration, not legacy semantics. They are identified by stable
string keys, never by numeric ids with implicit meaning.

## Not in scope (unconfirmed)

The following are **discovery concepts only** and are **not approved**. They
must not be implemented, planned into a roadmap, or assumed from the fact that
a similar concept exists in `/sandelys`:

stock, purchasing, orders, order lines, dispatch, sales, warehouse movements,
quantities on hand, production, barcode workflows, reporting, Sandėlys
adapter/integration, data migration, synchronisation, tenant/company
architecture, machine integration.

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
- `partners.md`, `resources.md`, `receipts.md`, `warehouses.md`,
  `domain-glossary.md` — implemented business modules and confirmed terms
- `legacy-as-reference.md`, `architecture.md`, `TODO.md`
- Workspace ADR-004 (reference, not blueprint)
