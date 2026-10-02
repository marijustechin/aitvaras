# ATV-049 — Receiving queue, delivery routes, button hierarchy & PackingForm removal

- **Status:** done (uncommitted; for human review)
- **Scope:** receiving/navigation/UI consistency pass + remove a redundant domain concept
- **Depends on:** ATV-042…ATV-048 (receiving/packaging/discrepancy/navigation slice)

## Objective

Fix the `Nepatvirtinti gavimai` queue so it only contains deliveries that still
need receiving work; give the selected delivery a real route; establish one
consistent button hierarchy; remove the redundant `PackingForm` concept. No
discrepancy settlement.

## 1. `Nepatvirtinti gavimai` fix

Openness is **derived from the child batches** (no stored delivery status). The
API `IncomingDelivery` gains `pendingBatchCount` (PENDING child batches, computed
in `listDeliveries` via one grouped count and in `getDelivery` from the loaded
batches). The web queue filters with `openReceivingDeliveries`: a delivery stays
while `pendingBatchCount > 0` **or** `batchCount === 0` (just created); a delivery
whose batches are all `CONFIRMED` disappears. Confirmed deliveries remain in the
ADMIN `Gavimai` workflow.

## 2. Delivery route / navigation

`/receiving` is now the list (`Naujas gavimas` + open queue); the selected
delivery is a distinct route `/receiving/[deliveryId]`
(`ui/receiving-delivery.tsx`, reading `useParams()` like the other detail pages).
Selecting/creating navigates via `router.push`. The delivery screen has a
secondary `← Gavimų sąrašas` action (`DELIVERIES_LIST_BACK_LABEL`, link to
`/receiving`) replacing the ambiguous `Kitas gavimas`; the top-level
`Registruoti sandėlyje` nav always returns to the list. No `window.location`; no
selection depends on ephemeral React state.

## 3. Button hierarchy

New `shared/ui/button.ts` (`buttonClass` + constants), exported from `shared/ui`:
**primary** (solid black), **secondary** (filled dark neutral gray `bg-neutral-700
text-white`, + compact `SECONDARY_NAV_BUTTON_CLASS`), **outline** (compact neutral
row actions), **destructive** (red). Adopted for the reference-data child actions
(`Kategorijos`, `Tara`) and page back actions (`← Ištekliai`, `← Partneriai`,
`← Sandėliai`, `← Gavimai`, `← Gavimų sąrašas`) and the receiving actions. The
former one-off `secondaryButtonClass` (outline) in the receiving flow is replaced.

## 4. Ištekliai child navigation

`/resources` children are now secondary buttons: `Kategorijos` and `Tara` (the
`Pakavimo formos` link is removed with the concept).

## 5. PackingForm audit and outcome

**Outcome: removed.** `PackingForm` (`Pakavimo formos`; Dėžė, Maišas, Metalinis
narvas, Rulonas) fully overlapped `PackagingType` (`Tara`) and had **no live
dependency** (no `resource.packingFormId`, no receipt-line relation). Audit found
references only in its own module/contracts/page/seed/tests/docs. Removed: model,
table, API module, contracts, web feature/entity/route, seed script
(`pnpm seed:reference`), tests and docs.

## 6. Data migration

Migration `20260930140000_drop_packing_forms`:
1. `INSERT` every distinct `packing_forms.name` not already present in
   `packaging_types` as an active row with `tare_weight_kg = 0.000` (exact-name
   match → no duplicates);
2. `DROP TABLE "packing_forms"`.

Verified on dev: `packing_forms` gone; `Metalinis narvas` and `Rulonas` preserved
(tare `0.000`); `Dėžė`/`Maišas` (already `PackagingType`s) untouched.

## 7. Terminology

`Pakuotė` = physical package; `Tara` = `PackagingType` master data (now the
canonical packaging master data). No user-facing `Maišas` as a generic physical
object. Internal `Bag` naming unchanged.

## 8. Tests

- Queue: `openReceivingDeliveries` pending→present, empty→present,
  all-confirmed→absent, mixed→present; API `pendingBatchCount` (0 / N and drops to
  0 after confirm).
- Navigation: `/receiving` list vs `/receiving/[deliveryId]` detail; `router.push`
  to `/receiving/:id`; `← Gavimų sąrašas` returns to `/receiving`; no
  `window.location`; no `Kitas gavimas`.
- Buttons: `buttonClass` variants (primary/secondary/outline/destructive) and
  source adoption (reference children, back actions, receiving primary/destructive).
- PackingForm: references removed; `unknownField` used for the strict-schema test.

## Files changed

- DB: `schema.prisma` (PackingForm removed); migrations
  `20260930140000_drop_packing_forms`.
- Contracts: `incoming-deliveries.ts`/test (`pendingBatchCount`); removed
  `packing-forms.ts`/test + `index.ts` export.
- API: `batch.mapper.ts`, `batches.service.ts`, `test/batches.e2e.test.ts`;
  `app.module.ts`; removed `modules/packing-forms/`,
  `scripts/seed-reference-data.ts`, `test/packing-forms.e2e.test.ts`;
  `resources.e2e.test.ts`.
- Web: `shared/ui/button.ts` (+test), `index.ts`; `receiving-delivery.tsx` (new),
  `receiving-page.tsx` (rewritten), `manage-batches/{index,lib/receiving}.ts`
  (+tests), `app/receiving/[deliveryId]/page.tsx` (new); `resources-page.tsx` +
  back links in resources-categories/packaging-types/resource-details/new-resource/
  partner-details/warehouse-details/batch-details; removed
  `manage-packing-forms/`, `entities/packing-form/`, `app/resources/packing-forms/`.
- Docs: `batches.md`, `resources.md`, `packaging-types.md`, `domain-glossary.md`,
  `scope.md`, `architecture.md`, `backend-architecture.md`,
  `frontend-architecture.md`, `authorization.md`, `receipts.md`, `development.md`,
  `AGENTS.md`, `README.md`, `TODO.md`, root `ops/`.

## Verification

- `pnpm verify` green: lint (0 errors), Prisma validate, typecheck, contracts
  **77** / web **233** / API **199**, Next + Nest builds (routes now include
  `/receiving/[deliveryId]`, no `/resources/packing-forms`).
- `git diff --check` clean.
- `prisma migrate diff` — no difference on dev and test DBs.
- `/sandelys` untouched; no commit/push.

## Unresolved / next

Discrepancy **settlement** (`DiscrepancySettlement`, `WEIGHT`/`MONEY`) remains the
next slice; `Ataskaitos` stays reserved for it. No money↔weight rule exists.
