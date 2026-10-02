# ATV-043 — Packaging / tare master data (Tara) with gross/net weights

- **Status:** done (uncommitted; for human review)
- **Scope:** extension of the uncommitted receiving slice — packaging/tare handling
- **Depends on:** ATV-042 (deliveries/batches/weight-based packages)

## Objective

Add explicit packaging/tare handling: a managed `PackagingType` (`Tara`) master-data
entity; every physical package references one packaging type and stores a
`grossWeight` plus the server-derived `netWeight = grossWeight − tare`; all
measured/reconciliation totals use net weight; corrections may change the
packaging type / gross weight / location; and a small ADMIN management UI/API is
added. No long-lived discrepancy register.

## 1. PackagingType master data

`PackagingType`: `id`, `name` (unique), `tareWeightKg Decimal(14,3)` (never
floating point), `active`, timestamps. Examples `Maišas` (0.800), `EPAL` (27.000).
API `GET/POST /packaging-types`, `GET/PATCH /packaging-types/:id` (read
authenticated, write ADMIN); no delete — deactivate only. UI page
`/resources/packaging-types` (linked from `Ištekliai` as **`Tara`**); contracts
`packaging-types.ts` (+ test); module `apps/api/src/modules/packaging-types/`.

## 2. Handling-unit relationship

`Bag` now stores `packagingTypeId` (FK, RESTRICT), `grossWeight`, `netWeight`
(replacing `weight`). `netWeight = grossWeight − tareWeightKg` is computed
server-side and never trusted from the client. Rejected: `grossWeight <= 0`,
`grossWeight <= tare` (`GROSS_NOT_ABOVE_TARE`), inactive packaging
(`PACKAGING_INACTIVE`). Historical packages may reference inactive packaging.

## 3. Totals, labels, corrections

- Measured totals (`Batch.totalNetWeight`, reconciliation `measuredWeight`) use
  `SUM(bags.netWeight)`; gross/tare preserved per package.
- Labels show `Gavimas`, warehouse, location, category, resource, **net weight**
  (gross/tare secondary) and the barcode.
- Corrections allow `packagingTypeId`, `grossWeight`, `warehouseLocationId`;
  packaging/gross changes recompute net and append `PACKAGING` / `GROSS_WEIGHT`
  (and/or `LOCATION`) rows to the existing `BagCorrection` trail; the measured
  batch total updates.

## 4. Receiving UI

Package entry: `Tara` (active types), `Vieta`, `Bruto svoris`; the UI shows the
calculated `Taros svoris` and `Neto svoris`. The correction editor mirrors this.
Package lists/detail show net weight.

## 5. Migration strategy

New forward migration `packaging_types` (ATV-042 already applied to the local
dev/test DBs, so no reset was needed): creates `packaging_types`; inserts an
**inactive** `Nežinoma tara` (tare 0.000) as the explicit unknown-provenance
value; adds `bags.packaging_type_id` + `gross_weight`, renames `bags.weight` →
`net_weight`, backfills `gross_weight = net_weight` and
`packaging_type_id = 'Nežinoma tara'`; renames `BagCorrectionKind` value
`WEIGHT` → `GROSS_WEIGHT` and adds `PACKAGING`. Existing weights are preserved
(net = gross, no invented tare). `prisma migrate deploy` applied to dev and test;
drift check clean on both.

## Contracts / API

`packaging-types.ts`; `Bag` = packaging/gross/net (no `weight`); `CreateBagRequest`
= `{packagingTypeId, grossWeight, warehouseLocationId}`; `UpdateBagRequest` =
`{packagingTypeId?, grossWeight?, warehouseLocationId?}`; `Batch.totalNetWeight`.

## Files changed

- DB: `schema.prisma`; migration `20260930110000_packaging_types`.
- Contracts: `packaging-types.ts` (+test), `batches.ts` (bag/batch/request +
  correction kind), `batches.test.ts`, `index.ts`.
- API: `modules/packaging-types/*` (new), `app.module.ts`,
  `modules/batches/{batch.mapper,batches.service}.ts`,
  `test/batches.e2e.test.ts`, `test/packaging-types.e2e.test.ts` (new).
- Web: `entities/packaging-type/*` (new),
  `features/manage-packaging-types/*` (new) + route
  `app/resources/packaging-types/page.tsx`, `features/manage-resources/ui/resources-page.tsx`,
  `features/manage-batches/lib/{batch-form,receiving}.ts` (+tests),
  `ui/{receiving-page,batch-details-page,gavimai-page,bag-label}.tsx`,
  `entities/batch/batch.ts` (+test).
- Docs: `packaging-types.md` (new), `batches.md`, `domain-glossary.md`, `scope.md`,
  `authorization.md`, `architecture.md`, `AGENTS.md`, `README.md`, `TODO.md`; this
  record.

## Verification

- `pnpm verify` green: lint, Prisma validate, typecheck, contracts **80** / web
  **202** / API **198**, Next + Nest builds.
- `git diff --check` clean.
- `prisma migrate diff --from-config-datasource --to-schema` — no difference on
  both dev and test databases.
- `/sandelys` untouched; no commit/push.

## Known limitations

- Historical packages have tare 0 (unknown provenance) and reference the inactive
  `Nežinoma tara`; no back-invented tare.
- Packaging types are deactivated, never deleted.
