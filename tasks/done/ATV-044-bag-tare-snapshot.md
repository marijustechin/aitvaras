# ATV-044 — Snapshot the packaging tare on the handling unit

- **Status:** done (uncommitted; for human review)
- **Scope:** narrow follow-up to the uncommitted receiving/PackagingType slice
- **Depends on:** ATV-043 (PackagingType / gross-net weights)

## Objective

`PackagingType.tareWeightKg` is editable master data; a historical `Bag` stores
`packagingTypeId`/`grossWeight`/`netWeight`. If the master tare changes later,
reading the tare from the live PackagingType record would make historical bags
look mathematically inconsistent. Historical physical records must preserve the
tare actually used. No change to receiving workflow or UI architecture.

## 1. Snapshot tare on Bag

Added `Bag.tareWeightKg Decimal(14,3)` — the immutable/current snapshot of the tare
used to compute the bag's current net weight. At creation the server loads the
active PackagingType, copies its `tareWeightKg` into the bag, and computes
`netWeight = grossWeight − tareWeightKg`. Historical net is never derived from the
live master value.

## 2. Packaging correction

When the packaging type changes on an editable bag, the server loads the selected
PackagingType, **re-snapshots** its current tare into `Bag.tareWeightKg`, and
recomputes `netWeight`. A gross-weight-only change keeps the snapshot and only
recomputes net. The `PACKAGING` audit row now records the previous/new packaging
name **and tare** (e.g. `Maišas (0.800 kg) → EPAL (27.000 kg)`), so the previous
and new tare/gross/net state is understandable; history is never overwritten.

## 3. Reads / labels / UI

`toBag` now returns `tareWeightKg` from the **bag snapshot** (packaging name still
comes from the referenced PackagingType; gross/net from the bag). The label and the
receiving UI show the snapshotted tare for an existing package; the correction
editor previews the bag's snapshot unless the packaging type is being changed (then
it previews the newly selected type's current tare). `gross − snapshot tare = net`
holds historically.

## 4. Migration

Integrated into the existing uncommitted `packaging_types` migration (not stacked):
`bags.tare_weight_kg` is added alongside `gross_weight`, and the backfill sets
`tare_weight_kg = 0.000`, `gross_weight = net_weight` (previously `weight`) and
`packaging_type_id = 'Nežinoma tara'`, preserving existing net unchanged. Because
the migration was already applied locally, the local dev/test DBs were
reset/rebuild (`prisma migrate reset --force` + `pnpm db:test:reset`, then
`pnpm seed:dev`/`seed:reference`) with explicit user consent.

## Contracts / API

No contract change (`Bag.tareWeightKg` already existed; it now sources from the bag
snapshot). `createBag`/`correctBag` set the snapshot; `toBag` reads it.

## Files changed

- DB: `schema.prisma`; migration `20260930110000_packaging_types` (extended).
- API: `modules/batches/{batch.mapper,batches.service}.ts`,
  `test/batches.e2e.test.ts` (snapshot tests).
- Web: `features/manage-batches/ui/receiving-page.tsx` (correction tare preview).
- Docs: `packaging-types.md`, `batches.md`, `TODO.md`; this record.

## Verification

- `pnpm verify` green: lint, Prisma validate, typecheck, contracts **80** / web
  **202** / API **200**, Next + Nest builds.
- `git diff --check` clean.
- `prisma migrate diff --from-config-datasource --to-schema` — no difference on
  both the dev and test databases (after rebuild).
- `/sandelys` untouched; no commit/push.

## Known limitations

- Historical packages snapshot tare `0.000` (unknown provenance); no back-invented
  tare. Packaging types remain deactivate-only.
