# ATV-016 — Resources, Resource Categories & Packing Forms

**Status:** done
**Date:** 2026-09-21
**Target repository:** `/aitvaras`
**Workspace ID:** O-052

## Objective

Second confirmed Aitvaras business-domain scope: **Ištekliai** (resources),
**Išteklių kategorijos** (fixed categories) and **Pakavimo formos** (packing
forms as independent reference data). No goods receipt, purchasing, stock
balances, warehouse locations, quantities, production, orders or sales.

## Domain decisions

- **Resource** = a business item/material/product. Exactly one category; a
  required name; optional notes; active/inactive lifecycle.
- **Categories** are a small fixed domain classification (stable enum), not
  user-managed configuration. Adding one is a domain/schema decision.
- **PackingForm** is **independent master data**, deliberately **not** a
  permanent property of a resource (a later receipt may use a different form).
  No `resource.packingFormId` and no resource↔packing-form join table.
- No `name` uniqueness on resources (two resources may share a descriptive
  name). Packing-form `name` is unique so the reference seed is idempotent.
- Deactivate, never delete; inactive rows remain queryable.

## Database

- Enum `ResourceCategoryKey` (`RAW_MATERIAL`/`SEMI_FINISHED`/`FINISHED_PRODUCT`).
- `Resource` (`resources`): UUID id, required `name`, `category`, optional
  `notes`, `active` default true, timestamps; indexes on `name` and `category`.
- `PackingForm` (`packing_forms`): UUID id, unique `name`, `active` default
  true, timestamps.
- Forward migration `20260921093301_resources_and_packing_forms` (no history
  rewrite).

## Reference-data seed

`apps/api/src/modules/packing-forms/packing-form-seed.ts`
(`CONFIRMED_PACKING_FORMS`, `ensureConfirmedPackingForms`) + explicit script
`apps/api/src/scripts/seed-reference-data.ts` and `pnpm seed:reference`.
Explicit (never at startup), idempotent (existing rows untouched: no duplicates
/ rename / reactivation), separate from the authentication-only `seed:dev`.

## Contracts

`packages/contracts/src/resources.ts` and `packing-forms.ts` (exported from the
index) plus shared `fields.ts` (`optionalTextField`, now also used by
`partners.ts`): category keys/labels, `Resource`/`PackingForm` read shapes,
strict create/update schemas (unknown fields rejected; trimmed; blank names
rejected; empty optional → `null`; updates require ≥1 field). Tests included.

## API

`apps/api/src/modules/resources/` and `apps/api/src/modules/packing-forms/`
(controller/service/mapper/module); wired into `AppModule`.

| Endpoint | Requirement |
|---|---|
| `GET /resources`, `GET /resources/:id` | authenticated |
| `POST /resources`, `PATCH /resources/:id` | `ADMIN` |
| `GET /packing-forms`, `GET /packing-forms/:id` | authenticated |
| `POST /packing-forms`, `PATCH /packing-forms/:id` | `ADMIN` |

No DELETE. `ParseUUIDPipe` (400 invalid) + 404 missing. Ordering `name` asc
(then id). Duplicate packing-form name → 409. Reuses the existing role guard.

## Web

- Navigation: `Ištekliai` (`/resources`) between `Partneriai` and ADMIN-only
  `Naudotojai`; active for `/resources` and nested routes.
- `lib/resources.ts` (+test): category/status labels (reusing shared contracts
  labels), placeholders, form values ↔ payload, client validation.
- `components/resources/resource-form.tsx`; pages `/resources` (list; ADMIN
  `Naujas išteklius`; empty state; subtle `Pakavimo formos` link),
  `/resources/new` (ADMIN), `/resources/[id]` (details; ADMIN edit, non-admin
  read-only), `/resources/packing-forms` (reference-data administration; ADMIN
  create/rename/activate-deactivate, non-admin read-only). Home copy updated.

## Tests

- API `resources.e2e.test.ts` (9): unauth 401; non-admin read; non-admin write
  403; all three categories + default active; invalid category/blank name/
  missing name/unknown fields/invalid+missing id; admin edit incl. empty-update
  and unsupported-field rejection; deactivate + inactive readable; update does
  not affect another resource; name ordering.
- API `packing-forms.e2e.test.ts` (6): unauth 401; non-admin read; non-admin
  write 403; rename + deactivate + inactive readable; blank/unknown/duplicate/
  empty-update/404/400; **seed idempotency** (run twice → exactly one of each
  confirmed form).
- Web: navigation (`Ištekliai` visible/active incl. `/resources/packing-forms`)
  and category mapping (Žaliava/Pusgaminis/Gaminys).
- Totals: **API 93 / 15 files, web 34 / 5 files, contracts 23 / 5 files.**

## Verification

- `pnpm verify` → **exit 0**; build routes include `/resources`,
  `/resources/[id]`, `/resources/new`, `/resources/packing-forms`.
- Dev DB fingerprint identical before/after verify (`users`, `partners`,
  `resources`, `packing_forms` counts); tests used `aitvaras_test`
  (migration applied via `global-setup`).
- `pnpm seed:reference` run twice on dev: first `4 created`, second `0 created`
  (idempotent).
- Smoke (dev API/web): login; `GET /resources` 200; create one per category;
  edit; deactivate (inactive still listed); invalid category 400; blank name
  400; `GET /packing-forms` shows the four confirmed forms; create/rename/
  deactivate a form; `GET /partners` and `GET /users` and `/auth/me` still work;
  web routes 200; built JS contains `Ištekliai`, `Pakavimo formos`,
  `Naujas išteklius`, `Žaliava`, `Pusgaminis`, `Gaminys`.
- Smoke cleanup removed the 3 temp resources and 1 temp form; the pre-existing
  partner was left untouched; four confirmed forms remain; `localdev`/
  `localdev` unchanged.
- `git diff --check` exit 0; no secrets; `/sandelys` clean.

## Unresolved / notes

- `POST /resources` does not run `ensureConfirmedPackingForms`; reference data
  is seeded explicitly only.
- No pagination/search; no resource↔packing-form or receipt relationship yet.
- Resource `name` intentionally non-unique; no internal business code yet.

## Next step

None confirmed. Goods receipt/purchasing/stock/orders remain out of scope; any
future resource↔partner↔packing-form relationship needs a new confirmed
requirement.
