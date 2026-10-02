# ATV-047 — Compact delivery-local batch codes + receiving UI cleanup

- **Status:** done (uncommitted; for human review)
- **Scope:** narrow UI/identifier cleanup of the uncommitted receiving slice
- **Depends on:** ATV-042…ATV-046 (delivery/packaging/discrepancy receiving slice)

## Objective

The IncomingDelivery code is now the primary human-facing receipt identifier, so
the batch code no longer needs to be globally unique or long. Make the batch code a
compact, delivery-local `P01`..`P99`; clean up `Gavimai` filter wording; verify the
differs sign and keep the default pending queue date-unbounded. No settlement, no
receiving redesign.

## 1. New batch code format

Human-facing `Batch.code` is now `P<NN>` (`P01`, `P02`, ..., `P99`), **scoped to
one delivery** and reset for each new delivery. First batch = `P01`, second `P02`.
Max `99`; past that the API raises `409 BATCH_CODE_EXHAUSTED` and **never** emits
`P100`. The UUID `id` remains the technical identity. Delivery code + batch code is
enough for human context, e.g. `G2610-01 / P01`. Resource/warehouse are **not**
encoded.

## 2. Migration / index strategy

- Schema: dropped the global `@unique` on `Batch.code`; added
  `@@unique([deliveryId, code])`. The composite index also serves `deliveryId`
  lookups.
- Migration `20260930130000_batch_delivery_local_code`:
  1. `DROP INDEX "batches_code_key"`;
  2. deterministic renumber per delivery
     (`row_number() OVER (PARTITION BY delivery_id ORDER BY created_at, id)` →
     `P01`, `P02`, ...);
  3. `CREATE UNIQUE INDEX "batches_delivery_id_code_key" ON batches(delivery_id, code)`.
- Generation is concurrency-safe: read the max existing code in the delivery, then
  insert under the composite unique constraint with retry on conflict (the existing
  `resolveBatch` loop). Same code may exist in different deliveries; the same code
  cannot duplicate inside one delivery.
- **Migration limitation:** a delivery with more than 99 historical batches would
  produce `P100+`; this cannot occur with the current data (each migrated delivery
  holds a single batch) and new batches are capped at `P99`. Documented in
  `docs/batches.md`.

## 3. Filter wording

ADMIN `Gavimai` generic supplier/resource/warehouse options changed from `Visos` to
masculine **`Visi`** (grammar: Tiekėjas/Išteklius/Sandėlis). The status filter
wording is unchanged (`Būsena`). `Partijos kodas` search placeholder updated to
`P01`.

## 4. Date-filter behavior

The default `Reikia patvirtinti` queue is **not date-bounded**: `Priėmimo data nuo`
/ `Priėmimo data iki` stay empty by default (`createBatchListFilters`), so old
pending items are never silently hidden. No presets added (out of scope).

## 5. Terminology cleanup

Active UI uses `Pakuotė` / `Pakuotės` for physical handling units; no stale
`Maišas`/`Maišai`/`maišą`/`maišai` remains (grep of `apps/web/src`). `Tara` is kept
only for the PackagingType/master-data meaning (Maišas, Dėžė, EPAL, ...). Internal
`Bag` naming is unchanged.

## 6. Difference sign verification

`difference = measuredWeight − documentWeight` is consistent. Positive differences
now render with an explicit `+` (`+19,200 kg`); negative use the lt-LT U+2212 minus
(`−10,000 kg`); exact is unsigned. Added `formatSignedWeight` and applied it to the
confirmed-difference displays (success message, discrepancy banner, detail summary).
Mismatch stays rose/red. No discrepancy logic changed.

## 7. Table readability

`Gavimai` columns are `Gavimas` (delivery code) and `Partija` (`P01`), with no
duplicated verbose technical info and no UUID exposed.

## Files changed

- DB: `schema.prisma`; migration `20260930130000_batch_delivery_local_code`.
- Contracts: `batches.test.ts`, `incoming-deliveries.test.ts` (fixtures).
- API: `modules/batches/batch-code.ts` (`P<NN>`, `MAX_BATCH_SEQUENCE`),
  `batches.service.ts` (`nextBatchCode(deliveryId)`, overflow `BATCH_CODE_EXHAUSTED`),
  `test/batches.e2e.test.ts` (code tests).
- Web: `entities/batch/batch.ts` (+test) `formatSignedWeight`;
  `features/manage-batches/ui/gavimai-page.tsx` (`Visi`, placeholder);
  `ui/batch-details-page.tsx` (signed difference);
  `lib/batch-list.test.ts`, `lib/receiving.test.ts` (fixtures/assertions).
- Docs: `batches.md`, `domain-glossary.md`, `scope.md`, `AGENTS.md`, `TODO.md`; this
  record.

## Verification

- `pnpm verify` green: lint, Prisma validate, typecheck, contracts **80** / web
  **212** / API **204**, Next + Nest builds.
- `git diff --check` clean.
- `prisma migrate diff` — no difference on both dev and test databases.
- `/sandelys` untouched; no commit/push.

## Unresolved / next

Review and commit the ATV-042…ATV-047 slice. Discrepancy **settlement**
(`DiscrepancySettlement`, `WEIGHT`/`MONEY`) remains the next slice; no money↔weight
conversion rule exists.
