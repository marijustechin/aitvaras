# ATV-071 — Receipt status filter and distinct receipt/action destinations

Status: **READY_FOR_HUMAN_REVIEW** (uncommitted, together with ATV-066…070).

## Objective

1. Reduce the receipt status filter to exactly three options with
   `Laukia patvirtinimo` as the default, including partially confirmed receipts,
   and map legacy saved pending-filter values without losing other filters.
2. Give the receipt number and the manager action distinct destinations:
   the number always opens `/receiving/[deliveryId]`; `Tvirtinti`/`Peržiūrėti`
   open `/receipts/[deliveryId]` for authorized managers.

## Implemented

### One pending status

- `Būsena` now contains exactly:
  - `Laukia patvirtinimo` (`PENDING`) — default; includes receipts with at least
    one pending batch, including partially confirmed receipts;
  - `Patvirtinta` (`CONFIRMED`) — all batches confirmed;
  - `Visos` (`ALL`) — all receipts, including zero-batch receipts.
- First visit, `Atstatyti filtrus` and invalid/missing saved state use
  `Laukia patvirtinimo`.
- Persisted `NEEDS_CONFIRMATION` values are migrated to `PENDING`; the other
  saved filters (supplier, resource, warehouse, dates, batch code) are preserved.
- The stored filter shape/key is unchanged (`aitvaras.priemimas.filters.v1`).
- `receiptRows` continues to include partially confirmed receipts in the pending
  view and includes zero-batch receipts only in `Visos`.

### Distinct destinations

On `/receipts`:

| Control | Destination | Visibility |
|---|---|---|
| Receipt number G… | `/receiving/[deliveryId]` (operational receipt) | Every receiving user, every status |
| `Tvirtinti` | `/receipts/[deliveryId]` (manager confirmation) | ADMIN/confirmation permission, receipt with a pending batch |
| `Peržiūrėti` | `/receipts/[deliveryId]` (manager review) | ADMIN/manager access, fully confirmed receipt |

- The receipt number is a normal anchor, not covered by an overlay; click,
  keyboard focus + Enter and direct navigation all follow its own operational
  link, including for ADMIN.
- `Tvirtinti` no longer confirms anything itself; it opens the manager screen,
  where the per-row `Patvirtinti partiją` performs confirmation.
- Warehouse workers see no `Tvirtinti`/`Peržiūrėti` actions. Their receipt number
  opens the operational page, where they can open a P… batch, inspect/edit while
  pending, and print labels for active packages. Confirmed batches remain
  read-only with label reprinting.
- Prices, expenses and confirmation controls remain manager-only.

## Files changed

- `apps/web/src/features/manage-batches/lib/batch-list.ts`
- `apps/web/src/features/manage-batches/lib/batch-list.test.ts`
- `apps/web/src/features/manage-batches/ui/gavimai-page.tsx`
- `docs/batches.md`
- `docs/domain-glossary.md`
- `TODO.md`
- `docs/screenshots/atv-071/`
- this record

## Decisions

- **One work status.** `NEEDS_CONFIRMATION` and `PENDING` duplicated the same
  receipt set; the three-option filter removes the duplication.
- **Receipt number is operational.** It must work for workers and managers on
  every status, so it always opens `/receiving/[deliveryId]`.
- **Manager actions are separate.** `Tvirtinti`/`Peržiūrėti` only open the
  manager receipt screen; confirmation remains the row action there.
- **Role-aware actions.** The API remains authoritative: confirmation is ADMIN;
  the UI only hides manager actions from workers.

## Verification

- `npm run verify` passed: lint, `db:validate`, typecheck, tests and builds.
  - API: 27 files / **267** tests.
  - Web: 31 files / **293** tests.
  - Contracts: 15 files / **104** tests.
- Browser verification with an isolated pending receipt:
  - ADMIN `/receipts`: status options were exactly
    `Laukia patvirtinimo` / `Patvirtinta` / `Visos`; default was
    `Laukia patvirtinimo`.
  - Receipt number `href` was `/receiving/[deliveryId]`; clicking and keyboard
    Enter both opened the operational page for ADMIN.
  - `Tvirtinti` opened `/receipts/[deliveryId]`; the separate
    `Patvirtinti partiją` action remained on that screen.
  - `Atstatyti filtrus` returned to `Laukia patvirtinimo`.
  - A persisted legacy filter with `NEEDS_CONFIRMATION` restored as `PENDING`
    while supplier `Nežinomas` and code `P01` were preserved.
  - Worker `/receipts`: receipt number opened `/receiving/[deliveryId]`;
    `Tvirtinti`/`Peržiūrėti` were absent; opening P01 exposed the `Spausdinti`
    label action and no financial controls.
- Screenshots in `docs/screenshots/atv-071/`:
  `receipts-list-manager-desktop.png`,
  `manager-confirmation-page-desktop.png`,
  `receipts-list-worker-desktop.png`,
  `worker-operational-receipt-desktop.png`,
  `worker-batch-label-desktop.png`.

## Live data

- The isolated receipt fixture (`G2611-08` during verification) and the
  temporary test worker user were removed.
- No live receipt was modified by this change. Existing live records and the
  operator’s ongoing data remain untouched.

## Unresolved / deliberately out of scope

- No server-side filter persistence; the sessionStorage behavior is retained.
- Manager actions are hidden client-side for workers; server-side confirmation
  permission remains authoritative.
- The three-option filter intentionally removes the separate
  `NEEDS_CONFIRMATION` value; historical task records still describe it.

## Recommended next task

Human review and commit of ATV-066…071. Any server-side filter state, pagination
change or permission-model change needs a new confirmed task.
