# ATV-053 — Refresh delivery summary after receiving mutations

- **Status:** done (uncommitted; for immediate manual testing)
- **Scope:** narrow state-synchronisation fix in the uncommitted PIECE slice
- **Depends on:** ATV-051/ATV-052 (piece-based receiving)

## Root cause

On `/receiving/[deliveryId]/batches/[batchId]` the `Gavimo turinys` summary reads
`state.delivery`, which was loaded once on mount. The PIECE handlers
(`submitItem`, `submitItemCorrection`, `submitItemVoid`) re-fetched only
`/batches/:id` and updated `state.batch`, so the parent delivery summary stayed
stale until a full re-fetch/navigation. (WEIGHT handlers already refreshed both.)

## Fix

Reuse the existing `refreshBatchAndDelivery()` helper (which fetches both
`/batches/:id` and `/deliveries/:id` in parallel) in the three PIECE handlers, and
update **both** `state.batch` **and** `state.delivery`. No per-field patching, no
full page reload, no `window.location`; the server remains the source of truth for
group/package count, total pieces, total/net weight and batch status.

## UX state preserved

The refresh only replaces `batch` + `delivery` in state; it does not reset the
active batch, the selected product, the current/suggested location, the receiving
route, or the label/reprint state. `Išsaugoti ir spausdinti` still opens the label
after a successful save, and the parent summary is already current at that point
(closing/reprinting is not required).

## WEIGHT parity

WEIGHT already used `refreshBatchAndDelivery()` for add/correct/void; kept as the
shared mechanism (no PIECE-only hack).

## Files changed

- `apps/web/src/features/manage-batches/ui/receiving-delivery.tsx` (PIECE handlers
  now refresh the parent delivery).
- Tests: `apps/api/test/piece-batches.e2e.test.ts` (delivery summary reflects
  add/correct/void), `apps/api/test/batches.e2e.test.ts` (WEIGHT add/correct/void
  summary), `apps/web/.../lib/receiving.test.ts` (shared-refresh source assertion).

## Verification

- `pnpm verify` green: lint, Prisma validate, typecheck, contracts **91** / web
  **267** / API **221**, Next + Nest builds.
- `git diff --check` clean.
- No migration work (schema unchanged; drift unaffected).
- `/sandelys` untouched; no commit/push.
