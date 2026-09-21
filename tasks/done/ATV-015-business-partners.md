# ATV-015 — Business Partners module (Partneriai)

**Status:** done
**Date:** 2026-09-21
**Target repository:** `/aitvaras`
**Workspace ID:** O-051

## Objective

Implement the first confirmed Aitvaras business-domain module: **business
partners**. One unified partner concept (no separate supplier/buyer entities),
multi-valued business roles, active/inactive lifecycle, list/details UI, and
ADMIN-only mutation. No resources, goods receipt, purchasing, stock, production
or orders.

## Domain decisions

- A partner is a business counterparty. One entity, never split into `Supplier`
  and `Buyer`.
- Partner roles are `SUPPLIER`/`BUYER` (Tiekėjas/Pirkėjas), multi-valued, at
  least one required, both allowed. They are **business roles**, deliberately
  separate from system access roles (`RoleKey`).
- Lifecycle: partners are deactivated, not deleted (referenced by future
  history). `GET` returns inactive partners too.
- No speculative uniqueness on `companyCode`/`vatCode`; no Lithuania-only
  validation; country is free text for now.

## Database

- `BusinessPartner` (`business_partners`) — UUID id, `name` required, optional
  `companyCode`/`vatCode`/`address`/`country`/`contactPerson`/`phone`/`email`/
  `notes`, `active` default true, `createdAt`/`updatedAt`; index on `name`.
- `PartnerRole` (`partner_roles`) — normalised join, composite PK
  (`partner_id`, `role`) + FK cascade on the partner; enum `PartnerRoleKey`.
- New forward migration `20260921091127_business_partners` (no history rewrite).

## Contracts

`packages/contracts/src/partners.ts` (exported from the index):

- `PARTNER_ROLE_KEYS`, `PartnerRoleKeySchema`, `PARTNER_ROLE_LABELS`,
  `sortPartnerRoles` (deterministic, de-duplicated).
- `PartnerSchema` (shared read shape), `PARTNER_FIELD_LIMITS`.
- `CreatePartnerRequestSchema` / `UpdatePartnerRequestSchema` — `.strict()`
  (unknown fields rejected), name required/trimmed, roles `.min(1)`, optional
  text trimmed with empty → `null`, update requires at least one field.
- Tests: `partners.test.ts` (labels, ordering, validation, strictness).

## API

`apps/api/src/modules/partners/` — `partners.controller.ts`,
`partners.service.ts`, `partner.mapper.ts`, `partners.module.ts`; wired into
`AppModule`.

| Endpoint | Requirement |
|---|---|
| `GET /partners` | authenticated — ordered by `name` asc (then id) |
| `GET /partners/:id` | authenticated — `ParseUUIDPipe` (400 invalid, 404 missing) |
| `POST /partners` | `ADMIN` |
| `PATCH /partners/:id` | `ADMIN` |

No `DELETE`. Roles replaced transactionally; id always from the route. Reuses the
existing global `JwtAuthGuard`/`RolesGuard` — no new permission framework.

## Web

- Navigation: `Partneriai` (`/partners`) for authenticated users, between
  `Pradžia` and ADMIN-only `Naudotojai`; active for `/partners` and nested
  routes.
- `lib/partners.ts`: role/status labels, summaries, form values ↔ payload,
  client validation, empty-state text; `lib/partners.test.ts`.
- `components/partners/partner-form.tsx`: shared create/edit form.
- `app/partners/page.tsx` (list; ADMIN sees `Naujas partneris`; empty state),
  `app/partners/new/page.tsx` (ADMIN), `app/partners/[id]/page.tsx` (details;
  ADMIN edit, non-admin read-only). Home copy updated (partners now exist).

## Tests

- API `test/partners.e2e.test.ts` (11): unauth 401; non-admin list/read 200;
  non-admin create/update 403; supplier/buyer/both create; defaults + trim +
  empty→null; zero roles/blank name/missing name/unknown fields/invalid id/
  missing id; admin update + zero-role & empty-update rejection; deactivate
  keeps it queryable; update does not mutate another partner; deterministic
  roles; name ordering.
- Web: navigation (Partneriai visible/active), partner mapping (Tiekėjas,
  Pirkėjas, Būsena).
- Totals: **API 78 / 13 files, web 24 / 4 files, contracts 13 / 3 files.**

## Verification

- `pnpm verify` → **exit 0**; build routes include `/partners`,
  `/partners/[id]`, `/partners/new`.
- Dev DB fingerprint identical before/after verify (`users=2`, `partners=0`);
  tests used `aitvaras_test` (migration applied there via `global-setup`).
- Smoke (local dev, API `3010` / web `3011`): login; unauth 401; empty list;
  create supplier-only 201; edit to supplier+buyer; deactivate; detail shows
  inactive; zero roles 400; web `/partners`, `/partners/new`, `/partners/[id]`
  200; built JS contains `Partneriai`/`Naujas partneris`/`Vaidmenys`/
  `Tiekėjas`/`Pirkėjas`/`Būsena`. Smoke partner removed afterwards; no orphan
  `partner_roles`; `localdev`/`localdev` unchanged.
- `git diff --check` exit 0; no secrets; `/sandelys` clean.

## Unresolved / notes

- No pagination/search yet (structure allows adding later).
- No partner role history/versioning.
- Country normalisation deferred until a real workflow requires it.
- `companyCode`/`vatCode` uniqueness deliberately deferred (task requirement).

## Next step

None confirmed. Any further business scope (resources, categories, packing
forms, transactions) requires a new confirmed requirement; glossary terms are
context only.
