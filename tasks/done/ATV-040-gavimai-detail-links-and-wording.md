# ATV-040 — Gavimai detail links and confirmation wording

- **Status:** done (uncommitted; for human review)
- **Scope:** very small ADMIN `Gavimai` detail-page cleanup
- **Depends on:** ATV-038 (`Gavimai` queue), ATV-039 (row interaction)

## Objective

Fix the dead back navigation and align the ADMIN confirmation wording with the
`Gavimai` terminology. No reconciliation/data-model/API/authorization change.

## 1. Navigation fix

The batch detail page's two `← Partijos` links (which pointed at the removed
`/receipts/batches` list) now render `← Gavimai` and link to the active ADMIN
queue `/receipts`, reusing `GAVIMAI_ACTION` (`label`/`href`) from `entities/batch`.
The warehouse-worker `Registruoti sandėlyje` flow is untouched.

## 2. Terminology

On the formal reconciliation card:

- Heading `Patvirtinti pajamavimą` → **`Patvirtinti gavimą`**.
- Primary button `Patvirtinti pajamavimą` → **`Patvirtinti gavimą`**.

Both use the shared constant `CONFIRM_RECEIPT_LABEL` (`lib/batch-list.ts`). Related
user-facing copy was aligned: success `Gavimas patvirtintas.`, error
`Nepavyko patvirtinti gavimo`, and the confirmed summary heading
`Gavimo patvirtinimas`. No internal API/module/domain identifier was renamed.

## 3. Domain distinction

`Registruoti sandėlyje` (worker physical receiving) · `Gavimai` (ADMIN
review/history) · `Patvirtinti gavimą` (ADMIN formal confirmation). No
`Pajamavimas` remains in the user-facing copy of this ADMIN flow.

## Files changed

- `features/manage-batches/lib/batch-list.ts` (+`CONFIRM_RECEIPT_LABEL`) and
  `batch-list.test.ts` (+3 tests);
- `features/manage-batches/ui/batch-details-page.tsx` (back links, confirmation
  heading/button, success/error copy);
- docs `batches.md`, `TODO.md`; this record.

No contracts/API/DB/authorization change.

## Tests

- `batch-list` (web, +3): `CONFIRM_RECEIPT_LABEL` is `Patvirtinti gavimą`; the
  detail page source links via `GAVIMAI_ACTION.href`/`.label` and no longer
  contains `"/receipts/batches"`; it uses `CONFIRM_RECEIPT_LABEL` and contains no
  `Patvirtinti pajamavimą` / `pajamavim` wording.
- `entities/batch` (existing) covers `GAVIMAI_ACTION` label `Gavimai` / href
  `/receipts`.
- No brittle CSS tests.

## Verification

- `pnpm verify` green: contracts **66**, web **190**, API **173**; lint, Prisma
  validate, typecheck, Next + Nest builds.
- `git diff --check` clean.
- `/sandelys` untouched; no commit/push.

## Limitations

- The unused `entities/receipt` `EMPTY_RECEIPTS_MESSAGE` constant (dead since the
  receipts list UI was removed in ATV-038) still contains the word `Pajamavimų`;
  it is not rendered anywhere and was left out of scope.
