# Ištekliai, kategorijos ir pakavimo formos

> Status: **implemented** — the second confirmed Aitvaras business-domain scope
> (task O-052). Covers **Ištekliai**, **Išteklių kategorijos** and **Pakavimo
> formos** only. Goods receipt, purchasing, stock balances, warehouse locations,
> quantities, production, orders and sales are **not** implemented.

See also: [domain-glossary.md](domain-glossary.md), [partners.md](partners.md),
[scope.md](scope.md).

## Resource (Išteklius)

A resource is a business item/material/product handled by Aitvaras.

Confirmed fields only:

| Field | Required | Notes |
|---|---|---|
| `name` | yes | non-empty, trimmed, ≤ 255 |
| `categoryId` | yes | id of exactly one **managed** resource category (see below) |
| `active` | yes | defaults to `true` |
| `notes` | no | internal free text, ≤ 2000 |

Deliberately **absent** until confirmed: purchase price, sales price, VAT,
barcode, quantity, stock, warehouse location, supplier, packing form,
dimensions, weight, unit of measure, reorder level.

### Identity

- UUID identity is immutable.
- Identity is **not** derived from name, category, legacy ids or supplier codes.
- `name` is intentionally **not unique**: two resources may share or resemble a
  descriptive name. An internal business code, if ever needed, is confirmed
  separately.

### Lifecycle

- `Būsena`: `Aktyvus` / `Neaktyvus`. Resources are **deactivated, not deleted**;
  future historical transactions may reference them.
- Inactive resources remain queryable (`GET` returns them).

## Resource categories (Išteklių kategorijos)

A resource has **exactly one** category. Resource categories are
**administrator-managed master data** (entity `ResourceCategory`: UUID `id`,
unique `name`, `active`, timestamps) — **not** a closed enum.

The three historical values are **seeded default records**, not the complete
allowed set:

| Default category | Created by |
|---|---|
| `Žaliava` | the `managed_resource_categories` migration |
| `Pusgaminis` | idem |
| `Gaminys` | idem |

- Administrators create/rename categories and activate/deactivate them; the
  server enforces the `ADMIN` role.
- `name` is required, trimmed, ≤ 255 and **unique** (duplicate → `409`).
- Categories are **deactivated, never hard-deleted**; a category referenced by a
  resource is never removed.
- **Inactive categories** remain valid for existing resources (they stay
  queryable and keep their category), but cannot be selected for a **new**
  resource (`400`). Reassigning an inactive category to another resource is also
  rejected.
- The three historical values are **data, not behaviour**: no code branches on
  a category name or key.

> **Classification only.** A resource category classifies a resource; it does
> **not** encode or drive the production lifecycle, and it is **not** a state
> machine. Do not assume a fixed `Žaliava -> Pusgaminis -> Gaminys` sequence:
> one production operation may produce several outputs at once. Category also does
> **not** provide provenance — batch/lot identity is separate. See the confirmed
> future principles in [scope.md](scope.md).

## Packing forms (Pakavimo formos)

A packing form describes how goods are physically packed/presented for
handling/storage.

Confirmed initial reference forms:

```text
Dėžė
Maišas
Metalinis narvas
Rulonas
```

Entity (`PackingForm`): `id`, `name` (unique), `active`, `createdAt`,
`updatedAt`. No dimensions/weight/capacity/units yet.

### Independent reference data

Packing forms are **independent master data**, deliberately modelled **not** as
a permanent property of a resource:

- `Resource` has **no** `packingFormId`, and there is **no** resource↔packing
  form join table.
- Reason: a resource may later arrive in different packing forms depending on a
  particular receipt or supplier. The connection belongs to the future
  receipt/transaction model, which is **not implemented or designed yet**.

### Reference-data seed (explicit, idempotent)

The four confirmed forms are created by a dedicated, deliberate seed — kept
separate from the authentication-only `seed:dev`:

```bash
pnpm seed:reference
```

- **Explicit:** never runs at startup; must be invoked.
- **Idempotent:** existing forms are left untouched (no duplicates, no renaming,
  no reactivation); safe to re-run.
- Implemented in `apps/api/src/modules/packing-forms/packing-form-seed.ts`
  (`ensureConfirmedPackingForms`), which the tests also exercise.

## Category vs packing form (important distinction)

```text
Išteklius: Medvilninis audinys
Kategorija: Žaliava
```

does **not** mean that:

```text
Pakavimo forma: Rulonas
```

is a permanent property of that resource. A later delivery could use a
different packing form. Category is intrinsic to the resource; packing form is
a property of a future handling/receipt event.

## Authorization

Reuses the existing role/authorization infrastructure — no new permission
framework.

| Capability | Endpoint | Requirement |
|---|---|---|
| List resources | `GET /resources` | authenticated |
| Resource details | `GET /resources/:id` | authenticated |
| Create resource | `POST /resources` | `ADMIN` |
| Update resource (incl. category, active) | `PATCH /resources/:id` | `ADMIN` |
| List resource categories | `GET /resource-categories` | authenticated |
| Resource-category details | `GET /resource-categories/:id` | authenticated |
| Create resource category | `POST /resource-categories` | `ADMIN` |
| Update resource category (name / active) | `PATCH /resource-categories/:id` | `ADMIN` |
| List packing forms | `GET /packing-forms` | authenticated |
| Packing-form details | `GET /packing-forms/:id` | authenticated |
| Create packing form | `POST /packing-forms` | `ADMIN` |
| Update packing form (name / active) | `PATCH /packing-forms/:id` | `ADMIN` |

Authenticated non-admins can view both; the **server** rejects direct write
attempts with `403`, regardless of UI visibility. No `DELETE` endpoints.

## API, contracts and UI

- API modules: `apps/api/src/modules/resources/`,
  `apps/api/src/modules/resource-categories/`,
  `apps/api/src/modules/packing-forms/`.
- Shared contracts: `@aitvaras/contracts` (`resources.ts`,
  `resource-categories.ts`, `packing-forms.ts`) — strict schemas (unknown fields
  rejected), trimmed text, blank names rejected, updates require at least one
  field. Resource responses denormalise the category
  (`categoryId`/`categoryName`/`categoryActive`) so an inactive assigned category
  stays visible.
- Default ordering: `name` ascending (then id) for all three.
- UI routes (inside the shell): `/resources` (list), `/resources/new` (ADMIN),
  `/resources/[id]` (details; ADMIN edit), `/resources/categories` (managed
  resource categories — ADMIN write), `/resources/packing-forms` (supporting
  reference-data administration). Navigation: `Ištekliai` (authenticated).
  `Kategorijos` and `Pakavimo formos` are intentionally **not** primary nav items;
  they are linked from `/resources`.
- The resource form loads categories from `GET /resource-categories` (no
  hard-coded category list); for a new resource it offers **active** categories
  only, and when editing it keeps the currently assigned category even if it is
  inactive.
- UI messages are Lithuanian (`Išteklių dar nėra.`, `Pakavimo formų dar nėra.`,
  `Įveskite ištekliaus pavadinimą.`, `Įveskite pakavimo formos pavadinimą.`).

## Future process (not implemented)

Actual receipt/transaction processes may connect `Partneris`, `Išteklius` and
`Pakavimo forma` (e.g. a receipt line referencing a resource and a packing
form). That relationship is **not implemented and not formally designed yet**.
