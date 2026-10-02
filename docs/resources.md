# Ištekliai ir kategorijos

> Status: **implemented** — the second confirmed Aitvaras business-domain scope
> (task O-052). Covers **Ištekliai** and **Išteklių kategorijos** only. Physical
> packaging master data is `PackagingType` / `Tara` (see
> [packaging-types.md](packaging-types.md)). Goods receipt, purchasing, stock
> balances, warehouse locations, quantities, production, orders and sales are
> **not** implemented.

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
barcode, quantity, stock, warehouse location, supplier, dimensions, weight, unit
of measure, reorder level. Physical packaging is **not** a resource property — it
is `PackagingType` / `Tara` master data used by receiving.

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

## Physical packaging is separate

How goods are physically packed (bag, box, pallet, cage, roll, ...) is **not** a
resource property and **not** a separate "packing form" concept. It is the
`PackagingType` / `Tara` master data (physical package type + tare weight) used by
the receiving flow — see [packaging-types.md](packaging-types.md) and
[batches.md](batches.md). A resource may arrive in different packaging at
different times; the choice is per physical package, not per resource.

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

Authenticated non-admins can view; the **server** rejects direct write attempts
with `403`, regardless of UI visibility. No `DELETE` endpoints.

## API, contracts and UI

- API modules: `apps/api/src/modules/resources/`,
  `apps/api/src/modules/resource-categories/`.
- Shared contracts: `@aitvaras/contracts` (`resources.ts`,
  `resource-categories.ts`) — strict schemas (unknown fields rejected), trimmed
  text, blank names rejected, updates require at least one field. Resource
  responses denormalise the category
  (`categoryId`/`categoryName`/`categoryActive`) so an inactive assigned category
  stays visible.
- Default ordering: `name` ascending (then id) for both.
- UI routes (inside the shell): `/resources` (list), `/resources/new` (ADMIN),
  `/resources/[id]` (details; ADMIN edit), `/resources/categories` (managed
  resource categories — ADMIN write), `/resources/packaging-types` (packaging
  master data — see [packaging-types.md](packaging-types.md)). Navigation:
  `Ištekliai` in the `Žinynai` group (authenticated). `Kategorijos` and `Tara`
  are secondary actions linked from `/resources`, not primary nav items.
- The resource form loads categories from `GET /resource-categories` (no
  hard-coded category list); for a new resource it offers **active** categories
  only, and when editing it keeps the currently assigned category even if it is
  inactive.
- UI messages are Lithuanian (`Išteklių dar nėra.`,
  `Įveskite ištekliaus pavadinimą.`).
