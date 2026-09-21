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
| `category` | yes | exactly one `ResourceCategoryKey` |
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

A resource has **exactly one** category. Currently a small, **fixed** domain
classification, represented as a stable enum (`ResourceCategoryKey`), not a
user-managed CRUD table:

| Key | Lithuanian |
|---|---|
| `RAW_MATERIAL` | Žaliava |
| `SEMI_FINISHED` | Pusgaminis |
| `FINISHED_PRODUCT` | Gaminys |

**Adding a new resource category is a domain/schema decision** (code + enum +
migration), not ordinary end-user configuration.

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
| List packing forms | `GET /packing-forms` | authenticated |
| Packing-form details | `GET /packing-forms/:id` | authenticated |
| Create packing form | `POST /packing-forms` | `ADMIN` |
| Update packing form (name / active) | `PATCH /packing-forms/:id` | `ADMIN` |

Authenticated non-admins can view both; the **server** rejects direct write
attempts with `403`, regardless of UI visibility. No `DELETE` endpoints.

## API, contracts and UI

- API modules: `apps/api/src/modules/resources/`,
  `apps/api/src/modules/packing-forms/`.
- Shared contracts: `@aitvaras/contracts` (`resources.ts`, `packing-forms.ts`) —
  strict schemas (unknown fields rejected), trimmed text, blank names rejected,
  updates require at least one field, centralised Lithuanian labels.
- Default ordering: `name` ascending (then id) for both.
- UI routes (inside the shell): `/resources` (list), `/resources/new` (ADMIN),
  `/resources/[id]` (details; ADMIN edit), `/resources/packing-forms`
  (supporting reference-data administration). Navigation: `Ištekliai`
  (authenticated). `Pakavimo formos` is intentionally **not** a primary nav item.
- UI messages are Lithuanian (`Išteklių dar nėra.`, `Pakavimo formų dar nėra.`,
  `Įveskite ištekliaus pavadinimą.`, `Įveskite pakavimo formos pavadinimą.`).

## Future process (not implemented)

Actual receipt/transaction processes may connect `Partneris`, `Išteklius` and
`Pakavimo forma` (e.g. a receipt line referencing a resource and a packing
form). That relationship is **not implemented and not formally designed yet**.
