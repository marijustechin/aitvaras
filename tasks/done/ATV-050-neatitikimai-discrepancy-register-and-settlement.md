# ATV-050 — Neatitikimai: receiving discrepancy register and settlement ledger

- **Status:** done (uncommitted; for human review)
- **Scope:** the long-lived discrepancy register + append-only settlement ledger
- **Depends on:** ATV-046 (ReceivingDiscrepancy), ATV-042…ATV-049 receiving slice

## Objective

Turn the existing `ReceivingDiscrepancy` anchor into an ADMIN register
(`Ataskaitos → Neatitikimai`) and add an append-only `DiscrepancySettlement`
ledger that records how a discrepancy is resolved — by additional physical weight
or by money/credit — without ever changing inventory or the original discrepancy.

## 1. Data model

- `ReceivingDiscrepancy` kept as the anchor (immutable signed
  `differenceWeight = measured − document`; `batchId` unique).
- `enum DiscrepancySettlementType { WEIGHT, MONEY }`.
- `DiscrepancySettlement`: `id`, `discrepancyId`, `type`, `coveredWeightKg`
  `Decimal(14,3)`, `moneyAmount` `Decimal(14,2)?`, `currency?`, `sourceBatchId?`,
  `reference?`, `note?`, `createdById`, `createdAt`. FKs `Restrict`; append-only
  (no delete/edit). Migration `20260930150000_discrepancy_settlements`.

## 2. Balance / status rules

Server-derived, never client-supplied: `originalWeight = |differenceWeight|`,
`settledWeight = Σ coveredWeightKg`, `remainingWeight = original − settled`.
`OPEN` (no settlement) → `PARTIALLY_SETTLED` (settled > 0, remaining > 0) →
`SETTLED` (remaining 0, sets `settledAt` once). Over-settlement is prevented
transactionally.

## 3. WEIGHT settlement

`coveredWeightKg > 0`; optional `sourceBatchId` must exist, be `CONFIRMED`, and
belong to the same supplier (`SOURCE_BATCH_NOT_FOUND` /
`SOURCE_BATCH_NOT_CONFIRMED` / `SOURCE_BATCH_SUPPLIER_MISMATCH`). It adds **no**
stock — the later batch already owns that stock.

## 4. MONEY settlement

Requires `coveredWeightKg > 0`, `moneyAmount > 0` and `currency` (UI default
`EUR`). **No** money↔kg conversion and no inference of `coveredWeightKg` from
money. Weight settlements reject money fields.

## 5. Transactional creation

`$transaction`: `SELECT … FOR UPDATE` on the discrepancy row → load + re-derive
settled/remaining → validate `coveredWeightKg <= remaining` →
validate type/source batch → insert settlement → recompute status/`settledAt`.
Concurrent requests cannot over-settle.

## 6. Navigation

`Ataskaitos` group now contains `Neatitikimai` → `/reports/discrepancies`
(`requiredRoles: ["ADMIN"]`); hidden from `WAREHOUSE_WORKER`; active parent
highlight works.

## 7. Register UI

`/reports/discrepancies`: heading `Neatitikimai`; columns `Data`, `Gavimas`,
`Partija`, `Tiekėjas`, `Išteklius`, `Tipas`, `Neatitikimas`, `Padengta`,
`Likutis`, `Būsena`; signed difference + `Trūkumas`/`Perteklius`; restrained
status colours; whole-row link. Filters: status (default `Atviri`), supplier,
resource, direction, date from/to, delivery-code search, `Atstatyti filtrus`;
**no default date bound**.

## 8. Detail / history / settlement UI

`/reports/discrepancies/[id]`: immutable origin summary, balance
(`Pradinis neatitikimas` / `Padengta` / `Likutis`), `Padengimų istorija`
(date, `Svoriu`/`Pinigais`, covered weight, money, source batch, reference, note,
creator; empty state `Padengimų dar nėra.`), and the `Registruoti padengimą` form
(`Būdas`, `Padengiamas svoris, kg`, optional `Susijusi partija` for WEIGHT,
`Suma`+`Valiuta` for MONEY, optional `Nuoroda`/`Pastaba`). When `SETTLED` the form
is hidden and `Padengtas` shown.

## 9. API / contracts

`GET /receiving-discrepancies` (register rows + derived balance/direction),
`GET /receiving-discrepancies/:id` (detail + settlements), `POST
/receiving-discrepancies/:id/settlements` (`ADMIN`). Contracts extend
`receiving-discrepancies.ts` with direction, settlement types/labels, settlement,
register-row and detail schemas + the create request (`strict`).

## Files changed

- DB: `schema.prisma`; migration `20260930150000_discrepancy_settlements`.
- Contracts: `receiving-discrepancies.ts` (+ new test).
- API: new `modules/receiving-discrepancies/{discrepancy.mapper,
  receiving-discrepancies.service,receiving-discrepancies.controller,
  receiving-discrepancies.module}.ts`; `app.module.ts`;
  `test/receiving-discrepancies.e2e.test.ts`.
- Web: `entities/receiving-discrepancy/`; `features/manage-discrepancies/`
  (`lib/discrepancy-list.ts` +test, `lib/settlement-form.ts` +test,
  `ui/discrepancies-page.tsx`, `ui/discrepancy-details-page.tsx`, `index.ts`);
  `app/reports/discrepancies/page.tsx` + `[id]/page.tsx`;
  `widgets/app-shell/model/navigation.ts` (+test).
- Docs: `discrepancies.md` (new), `batches.md`, `scope.md`, `domain-glossary.md`,
  `architecture.md`, `authorization.md`, `backend-architecture.md`,
  `frontend-architecture.md`, `AGENTS.md`, `README.md`, `TODO.md`; root `ops/`.

## Verification

- `pnpm verify` green: lint (0 errors), Prisma validate, typecheck, contracts
  **83** / web **251** / API **210**, Next + Nest builds (`/reports/discrepancies`
  + `[id]` present).
- `git diff --check` clean.
- `prisma migrate diff` — no difference on dev and test DBs.
- `/sandelys` untouched; no commit/push.

## Unresolved / next

Settlement reversal/correction, overage-specific return/write-off semantics,
money↔weight conversion and server-side register filtering/pagination are out of
scope. Existing discrepancies appear automatically (no re-generation).
