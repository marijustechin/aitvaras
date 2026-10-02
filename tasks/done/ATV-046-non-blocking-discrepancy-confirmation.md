# ATV-046 — Non-blocking discrepancy confirmation and `ReceivingDiscrepancy` register

- **Status:** done (uncommitted; for human review)
- **Scope:** replace the blocking mismatch behavior with the confirmed workflow
- **Depends on:** ATV-030…ATV-045 (receiving/reconciliation/packaging slice)

## Objective

A documentary/physical mismatch must **not** block confirmation. Exact match
confirms with no discrepancy; a mismatch confirms (with explicit acknowledgement)
and records a separate, long-lived `ReceivingDiscrepancy`. The physical stock
remains the measured net weight. Replace the old blocking message and the
`DISCREPANCY` batch status.

## 1. New confirmation behavior

`POST /batches/:id/reconcile`:
- computes `measuredWeight = SUM(active bags.netWeight)` server-side;
- **exact match** (`measured == document`): confirms; batch → `CONFIRMED`; no
  discrepancy;
- **mismatch**: requires `acknowledgeDiscrepancy: true` (else `400
  DISCREPANCY_NOT_ACKNOWLEDGED`); then confirms; batch → `CONFIRMED`; creates one
  `OPEN` `ReceivingDiscrepancy`; measured stock unchanged; the document weight is
  not required to be edited.

## 2. Discrepancy entity

`ReceivingDiscrepancy`: `id`, `batchId` (**unique**), `supplierId`, `measuredWeight`,
`documentWeight`, `differenceWeight`, `status` (`OPEN | PARTIALLY_SETTLED |
SETTLED`), `createdById`, `createdAt`, `settledAt?`. Only `OPEN` creation is
implemented. Migration `20260930120000_receiving_discrepancies` (+ status enum;
backfills any historical `DISCREPANCY` batch into an OPEN discrepancy and
`CONFIRMED`).

## 3. Status-model change

`BatchStatus` simplified to `PENDING | CONFIRMED`; `DISCREPANCY` removed (the
discrepancy lives in `ReceivingDiscrepancy`) — the enum was recreated in the
migration (no competing source of truth). `isBatchOpen` = `PENDING` only.

## 4. Modal UX

On a non-zero difference, `Patvirtinti gavimą` opens a dialog:
title `Patvirtinti gavimą su neatitikimu?`; body states the signed difference and
that the receipt will be confirmed and the discrepancy registered separately;
primary `Taip, patvirtinti`, secondary `Ne` (closes, changes nothing). `Taip,
patvirtinti` calls the endpoint with `acknowledgeDiscrepancy: true`. No
`window.confirm`; a small inline `role="dialog"`/`aria-modal` overlay.

## 5. Sign convention

`difference = measuredWeight − documentWeight` (positive = received more) applied
everywhere (API summary/`Batch.difference`, web `formatWeightDifference`). Examples:
199.200 / 180.000 → `+19.2`; 170.000 / 180.000 → `-10`.

## 6. Transactional/idempotent

One transaction: resolve anchor → conditional `batch.updateMany` (`status !=
CONFIRMED`; count 0 → `BATCH_ALREADY_CONFIRMED`) → create discrepancy if non-zero.
The unique `batchId` + conditional update mean a retry/concurrent confirm cannot
create duplicate discrepancies; the client never supplies the difference.

## 7. Messages / queue

Removed `Užfiksuotas neatitikimas. Pataisykite dokumentinį svorį ir patvirtinkite
iš naujo.`. Success: `Gavimas patvirtintas.` (exact) or `Gavimas patvirtintas.
Neatitikimas <±weight> užregistruotas.` (mismatch). `Gavimai` default `Reikia
patvirtinti` = `PENDING`; a confirmed batch with an unresolved discrepancy shows as
`Patvirtinta` + a `Neatitikimas` marker on the detail/queue.

## Files changed

- DB: `schema.prisma`; migration `20260930120000_receiving_discrepancies`.
- Contracts: `receiving-discrepancies.ts` (new), `batches.ts`
  (`BatchStatus` minus DISCREPANCY, `hasOpenDiscrepancy`, `BatchDetail.discrepancies`,
  reconcile `acknowledgeDiscrepancy`, reconciliation `discrepancyId`/sign), `index.ts`,
  tests.
- API: `modules/batches/{batch.mapper,batches.service,batches.controller}.ts`,
  `test/batches.e2e.test.ts`.
- Web: `entities/batch/batch.ts` (+test), `lib/batch-list.ts` (+test),
  `lib/receiving.test.ts`, `ui/{batch-details-page,gavimai-page}.tsx`.
- Docs: `batches.md`, `domain-glossary.md`, `scope.md`, `architecture.md`,
  `AGENTS.md`, `TODO.md`; this record.

## Verification

- `pnpm verify` green: lint, Prisma validate, typecheck, contracts **80** / web
  **207** / API **202**, Next + Nest builds.
- `git diff --check` clean.
- `prisma migrate diff` — no difference on both dev and test databases.
- `/sandelys` untouched; no commit/push.

## Future settlement-register slice

Discrepancy **settlement** is the next slice (not built): a `DiscrepancySettlement`
entity with `WEIGHT` or `MONEY` types, status transitions `OPEN →
PARTIALLY_SETTLED → SETTLED`, and `settledAt`. **No money↔weight conversion rule
exists yet** and must not be invented.
