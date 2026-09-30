# ATV-039 — Gavimai row interaction and status colours

- **Status:** done (uncommitted; for human review)
- **Scope:** narrow UI follow-up to the ADMIN `Gavimai` list (`/receipts`)
- **Depends on:** ATV-038 (`Gavimai` admin queue)

## Objective

Make the `Gavimai` table cleaner and easier to scan: remove the separate action
button, make each row open the batch detail, rebalance the columns, and add
restrained semantic status colours. No filtering/reconciliation/authorization/
API/data-model change.

## 1. Removed action column

The `Peržiūrėti` column and its button were removed; the freed width goes to the
batch data.

## 2. Whole-row link

Each row is a link to `/receipts/batches/[id]` using the accessible
**stretched-link** pattern: the `<Link>` (Next.js) is in the first cell with an
`absolute inset-0` overlay, and the `<tr>` is `relative`. This keeps a single
real anchor (keyboard-focusable, focusable via Tab, Enter opens it) rather than a
mouse-only `onClick`; there are no nested interactive controls. The `<tr>` has
`transition-colors hover:bg-accent/50 focus-within:bg-accent/50`, the link has
`focus-visible:ring-2 focus-visible:ring-ring` for a visible focus state, and the
anchor keeps the pointer cursor by default.

## 3. Spacing / readability

Columns kept: `Partija`, `Priėmimo data`, `Tiekėjas`, `Išteklius`, `Sandėlis`,
`Maišai / kiekis`, `Būsena`. `whitespace-nowrap` on the code, date, quantity and
status cells (code/date never wrap awkwardly; quantity compact; status readable);
supplier/resource/warehouse wrap naturally. Minimal visual language preserved; no
horizontal scrolling.

## 4. Status colours

`batchStatusClass(status)` (in `lib/batch-list.ts`) maps:

| Status | Lithuanian | Class |
|---|---|---|
| `CONFIRMED` | Patvirtinta | `text-emerald-500` |
| `DISCREPANCY` | Neatitikimas | `text-rose-500` |
| `PENDING` | Laukiama patvirtinimo | `text-muted-foreground` |

Text colour only; the row is never coloured; no heavy pills or saturated
backgrounds.

## Files changed

- `features/manage-batches/lib/batch-list.ts` (+`batchStatusClass`) and
  `batch-list.test.ts` (+4 tests);
- `features/manage-batches/ui/gavimai-page.tsx` (row link, removed action column,
  column spacing, status colour);
- docs `batches.md`, `TODO.md`; this record.

No contracts/API/DB/authorization change.

## Tests

- `batch status display` (web, +2): `batchStatusLabel` maps `CONFIRMED` →
  `Patvirtinta`, `DISCREPANCY` → `Neatitikimas`, `PENDING` → `Laukiama
  patvirtinimo`; `batchStatusClass` → emerald / rose / muted.
- `batchDetailHref` (existing): a row maps to the correct detail href.
- `Gavimai row rendering (source)` (+2): the page source no longer contains the
  `Peržiūrėti` action and links each row via `batchDetailHref(batch.id)` using the
  stretched overlay (`absolute inset-0`) — a lightweight structural check, not a
  CSS-class snapshot.
- No brittle full Tailwind-class snapshots.

## Verification

- `pnpm verify` green: contracts **66**, web **187**, API **173**; lint, Prisma
  validate, typecheck, Next + Nest builds.
- `git diff --check` clean.
- `/sandelys` untouched; no commit/push.

## Limitations

- The project has no DOM testing library, so full-row clickability is verified by
  the stretched-link source check plus visual review rather than a rendered click
  test.
