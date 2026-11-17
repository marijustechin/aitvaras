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
| `companyCode` | yes (company partner) | registration number as text, trimmed, ≤ 64; leading zeros preserved |
| `vatCode` | no | ≤ 64 |
| `address` | no | ≤ 500 |
| `country` | yes (company partner) | ISO 3166-1 alpha-2 code, uppercase, selected from the standard list |
| `contactPerson` | no | ≤ 200 |
| `phone` | no | ≤ 64 |
| `email` | no | ≤ 254 |
| `notes` | no | internal free text, ≤ 2000; not shown in the list |

### Individual / natural-person distinction

The current model has **no** individual/natural-person flag or partner type. Every
partner is therefore treated as a company and requires the company
identification fields. If individuals become a confirmed requirement later, the
distinction must be modelled explicitly before relaxing the registration-number
rule — it must not be inferred from a missing code.

Rules:

- Name, country and registration number are required in **both** creation and
  editing, with frontend **and** API validation. A record may never be saved
  without them.
- **No Lithuania-only format.** Registration numbers are not validated by an
  LT-specific length, checksum or numeric pattern. Foreign formats are valid.
- Registration numbers are stored as **strings**, trimmed. Leading zeros are
  significant (`000123` stays `000123`). They are never parsed as numbers.
- `(country, companyCode)` is **unique**. The same registration number in a
  different country is allowed. The database has a unique index
  `business_partners_country_company_code_key` as the final guard.
- Duplicate submission returns HTTP `409` with a field-level Lithuanian message
  (`Šioje šalyje jau yra partneris su tokiu įmonės kodu.`) mapped to the
  `companyCode` input. It is not shown as a generic failure.
- Editing a partner without changing its identification is valid; the duplicate
  check excludes the record itself.
- Optional text is trimmed; an empty value is stored as `NULL`, never `""`.
- `vatCode` remains optional and non-unique.

## Country selection

- The web form uses a searchable selector backed by the standard ISO 3166-1
  dataset (`i18n-iso-countries`, Lithuanian locale, shared from
  `@aitvaras/contracts`).
- It displays full **Lithuanian country names** and stores the **alpha-2 code**
  (`Lietuva` → `LT`, `Jungtinė Karalystė` → `GB`).
- Search matches Lithuanian names (diacritics ignored) and country codes.
  Free text never becomes a value: the user must choose an option from the list.
- The same component is used for creating and editing partners.
- The complete country list is available; there is no separate
  country-management screen.

## Existing-data inspection and migration

Before adding the constraint, the development database was inspected
(2026-11-17):

| Finding | Result |
|---|---|
| Partners | 2, both named `Ediltex Ltd.` |
| Country values | both `Jungtinė Karalystė` → converted to `GB` |
| Missing registration numbers | 2 (left `NULL`; no numbers invented) |
| Duplicate non-null `(country, companyCode)` pairs | none |
| Ambiguous country values | none |
| Conflicting records | none (identical names/countries but no registration numbers) |
| Linked operations | both records have receipts/deliveries/discrepancies (8 receipts, 10 deliveries, 5 discrepancies in total) |

Migration `20261117120000_partner_identification` converts the recognizable UK
values to `GB`, normalises existing two-letter codes to uppercase, and creates
the unique index. Records are **not** merged and no registration numbers are
invented. The legacy rows keep `NULL` registration numbers until an administrator
fills them in through the edit form — the API rejects any further save that
leaves them missing (including partial updates).

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
  pavadinimą.`, `Pasirinkite bent vieną vaidmenį.`, `Įveskite įmonės kodą.`,
  `Pasirinkite šalį.`).
- Duplicate registration numbers are reported on the `Įmonės kodas` field, not
  as a generic request failure.

## Verification evidence

Screenshots of the required-field state, country search/selection, duplicate
field error and successful edit are in `docs/screenshots/atv-056/`.

## Future relationships (not specified)

Future purchase, receipt, sales and other transactions may **reference** a
partner. Those transaction models are **not** specified or implemented yet.

## Related documents

- [scope.md](scope.md) — confirmed scope
- [domain-glossary.md](domain-glossary.md) — confirmed domain terminology
- [authorization.md](authorization.md) — roles and route protection
- [legacy-as-reference.md](legacy-as-reference.md) — reference, not blueprint
