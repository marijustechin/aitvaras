# Business Partners (Partneriai)

> Status: **implemented** — the first confirmed Aitvaras business-domain module
> (task O-051). Only partners are in scope; resources, goods receipt,
> purchasing, stock, production and orders are **not** implemented.

## Domain decision

Aitvaras uses **one unified business-partner concept**. There is deliberately
**no separate `Supplier` and `Buyer` entity**: a single partner is a business
counterparty that may act in one or several roles at the same time.

```text
UAB Mediena
✓ Tiekėjas
✓ Pirkėjas
```

This design is an Aitvaras decision, independent of the legacy Sandėlys data
model (see [legacy-as-reference.md](legacy-as-reference.md), ADR-004).

## Partner roles

| Key | Lithuanian label |
|---|---|
| `SUPPLIER` | Tiekėjas |
| `BUYER` | Pirkėjas |

- A partner must have **at least one** role; both may be selected together.
- Partner roles are a **business-domain concept** and are deliberately separate
  from system **access roles** (`ADMIN`, `WAREHOUSE_WORKER`, `ACCOUNTING`,
  `PRODUCTION_MANAGER`). Do not model partner roles as user/system roles or the
  reverse.
- Stored in a normalised `partner_roles` join table (composite key
  `partner_id` + `role`), not a single enum column, so one partner can hold
  both roles. Role keys are stable and language-independent; the UI shows the
  Lithuanian label only.

## Entity

`BusinessPartner` (table `business_partners`), UUID identity, `createdAt` /
`updatedAt` timestamps, consistent with the rest of the schema.

| Field | Required | Notes |
|---|---|---|
| `name` | yes | non-empty, trimmed, ≤ 255 |
| `roles` | yes | at least one; `SUPPLIER` and/or `BUYER` |
| `active` | yes | defaults to `true` |
| `companyCode` | no | ≤ 64 |
| `vatCode` | no | ≤ 64 |
| `address` | no | ≤ 500 |
| `country` | no | ≤ 100, **free text** (no country subsystem yet) |
| `contactPerson` | no | ≤ 200 |
| `phone` | no | ≤ 64 |
| `email` | no | ≤ 254 |
| `notes` | no | internal free text, ≤ 2000; not shown in the list |

Rules:

- Optional text is trimmed; an empty value is stored as `NULL`, never `""`.
- **No Lithuania-only validation.** Company codes and VAT codes may be foreign
  or unknown: no fixed length, no VAT prefix assumption, no numeric-only rule.
- `companyCode` and `vatCode` are deliberately **not unique**. Foreign/unknown
  values and real operational requirements make global uniqueness speculative;
  it must be decided separately before being added.
- Country is intentionally lightweight for now (free text), to be normalised
  later only if real workflows require it.

## Lifecycle

- Partners are **deactivated, not deleted** from the normal UI. A partner will
  later be referenced by historical transactions and must not disappear from
  history.
- An `ADMIN` may switch a partner between `Aktyvus` / `Neaktyvus`.
- `GET` endpoints return inactive partners too (they remain queryable).
- There is no `DELETE` endpoint; physical deletion is outside scope.
- No role history/versioning yet.

## Authorization

Reuses the existing role/authorization infrastructure — no new permission
framework.

| Capability | Endpoint | Requirement |
|---|---|---|
| List partners | `GET /partners` | authenticated |
| Partner details | `GET /partners/:id` | authenticated |
| Create partner | `POST /partners` | `ADMIN` |
| Update partner (incl. roles, active) | `PATCH /partners/:id` | `ADMIN` |

Authenticated non-admins can view the list and details but see no create/edit
controls. **The server is the enforcement point**: a non-admin who calls
`POST`/`PATCH /partners` directly receives `403`, regardless of UI visibility.

## API and UI

- API module: `apps/api/src/modules/partners/` (controller, service, mapper).
- Shared contracts: `@aitvaras/contracts` (`partners.ts`) — strict request
  schemas (unknown fields rejected), role keys/labels and deterministic role
  ordering.
- List is ordered by `name` ascending (then id). Pagination/search are not
  implemented yet; the service is structured so they can be added later.
- UI routes (inside the application shell): `/partners` (list), `/partners/new`
  (ADMIN create), `/partners/[id]` (details; ADMIN edit). Navigation item:
  `Partneriai` (visible to authenticated users).
- UI messages are Lithuanian (`Partnerių dar nėra.`, `Įveskite partnerio
  pavadinimą.`, `Pasirinkite bent vieną vaidmenį.`).

## Future relationships (not specified)

Future purchase, receipt, sales and other transactions may **reference** a
partner. Those transaction models are **not** specified or implemented yet.

## Related documents

- [scope.md](scope.md) — confirmed scope
- [domain-glossary.md](domain-glossary.md) — confirmed domain terminology
- [authorization.md](authorization.md) — roles and route protection
- [legacy-as-reference.md](legacy-as-reference.md) — reference, not blueprint
