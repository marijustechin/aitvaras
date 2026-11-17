# ATV-057 — Receiving entry point, date standardisation and migration repair

- **Status:** done (uncommitted; for human review)
- **Priority:** operational readiness for goods arriving 2026-11-18
- **Scope:** terminology/navigation, shared date input/format, end-to-end receiving verification, migration checksum reconciliation

## Objective

Make the receiving entry point obvious (`Priėmimas` → `Naujas priėmimas`), make
every user-visible date `yyyy-mm-dd`, verify both receiving paths end to end before
the arrival, and repair the reported `piece_batches` migration checksum drift
without losing data.

## 1. Receiving navigation and terminology

- Sidebar destination and breadcrumb: `Gavimai` → **`Priėmimas`**.
- Removed the separate `Registruoti sandėlyje` sidebar destination.
- Added the primary **`Naujas priėmimas`** button beside the `Gautos partijos`
  heading, above the filters; it opens the existing workflow at
  `/receiving/new` (existing `/receiving`, delivery and batch URLs remain valid).
- Dashboard primary action and the receiving page entry heading now use
  `Naujas priėmimas`.
- One sidebar destination covers the list (`/receipts`), entry
  (`/receiving/new`), delivery (`/receiving/[deliveryId]`) and batch
  (`…/batches/[batchId]`) routes through `activeHrefs`, so `Priėmimas` remains
  active throughout.
- Renamed user-facing receipt references: `Gavimas` → `Priėmimas`,
  `Nepatvirtinti priėmimai`, `Naujas priėmimas`, `Pradėti priėmimą`,
  `Priėmimo turinys`, `← Priėmimų sąrašas`, `Patvirtinti priėmimą`, label
  `Priėmimas`. Internal identifiers (`IncomingDelivery`, `GAVIMAI_*`, code prefix
  `G`, API paths) were preserved.
- `Gautos partijos` remains the list heading. Batches remain separate from the
  receipt: `Nauja partija` is still the in-receipt batch action, never the
  workflow entry point.

## 2. Date standardisation

- New shared `shared/lib/date.ts`: strict date-only validation, local date-part
  extraction, `yyyy-mm-dd` display, `yyyy-mm-dd HH:mm` timestamps, local-start
  conversion, progressive manual entry and calendar helpers.
- New shared `shared/ui/date-input.tsx` replaces all native `<input type="date">`
  (7 occurrences): forced `yyyy-mm-dd` visible value/placeholder, manual entry,
  calendar popover, clear controls, keyboard/Escape handling.
- Tables/details/labels/dialogs now use the shared formatters:
  `formatArrivalDate` → `yyyy-mm-dd`; `formatBatchDateTime` → `yyyy-mm-dd HH:mm`.
- Fixed date-only timezone drift in filtering/prefill: `isoDatePart()` is used
  instead of `iso.slice(0,10)`, so a local-midnight arrival does not move to the
  previous day. Inclusive ranges verified.
- Document dates are prefilled with the local date part and sent back as local
  start of day; no timezone day shift.
- Removed native validation bubbles from receiving forms (`noValidate`) so
  validation messages remain Lithuanian and controlled.

## 3. Walkthrough results (dev, 2026-11-17)

Clearly identified test supplier: **ATV057 Test Supplier** (created via API for
the test, removed afterwards with all its test receipts).

| Check | Result |
|---|---|
| `Priėmimas` list heading/active nav | `Gautos partijos`, active `Priėmimas`, no old sidebar item |
| `Naujas priėmimas` button | present beside heading, above filters |
| Date default / manual / clear / calendar | `2026-11-17` → cleared → manual `2026-11-18` → calendar `2026-11-18` |
| Entry route heading/breadcrumb | `Naujas priėmimas` / `Priėmimas` |
| Location required | blocked with `Pasirinkite sandėlio vietą.`; saved only after selecting `stelazas/1` |
| Suggested location | `stelazas/1` suggested for next package and survived reopen |
| WEIGHT path | delivery `G2611-02`, batch `P01`, 2 packages; gross 10.5 + 5.0, tare 0.8 each, net **13.900 kg**; barcode `2033840862536`; confirmed (mismatch acknowledged) |
| PIECE path | delivery `G2611-03`, batch `P01`, 2 item lines 3 + 2 = **5 vnt.**; barcode `2052539774707`; confirmed without discrepancy |
| Reopen/continue | delivery found in open queue, batch reopened by URL, all packages/items visible |
| Print check | label preview + print-media screenshot inspected; **no physical printer was tested** |
| Resulting stock | WEIGHT: 2 ACTIVE bags = 13.900 kg; PIECE: 2 ACTIVE item lines = 5 pcs; both batches `CONFIRMED` |

Test supplier, deliveries, batches, packages, items, discrepancies and linked
goods receipts were removed after verification; the development database is back
to its original counts (2 partners, 10 deliveries, 19 batches, 26 bags, 9 items,
8 goods receipts).

## 4. Migration drift reconciliation

Full record: [docs/migration-history.md](../../docs/migration-history.md).

- Cause: `20260930160000_piece_batches/migration.sql` was edited after it was
  applied on 2026-10-06. The actual database schema matches the current file
  (including `batch_items` void fields/constraints); only the checksum was stale.
- Backup before correction:
  `C:\Users\msmig\AppData\Local\Temp\opencode\aitvaras_pre_migration_repair_20261117.dump`
  (75,195 bytes, custom format, taken with `pg_dump`).
- Compared every migration checksum: only `piece_batches` drifted.
- Corrected the stored checksum in dev and test history to the current file's
  SHA-256; no reset, no data deletion, no history rows removed, no SQL re-run.
- `npm run db:migrate` now reports:
  `Already in sync, no schema change or pending migration was found.`
- `npm run verify` applies migrations to `aitvaras_test` successfully.

## Files changed

- Web navigation/terminology: `entities/batch/batch.ts`, app-shell navigation/
  tests, home, receiving page/list/delivery/batch detail, discrepancy list/detail,
  labels, batches constants/tests.
- Dates: `shared/lib/date.ts` + tests, `shared/ui/date-input.tsx`,
  `shared/ui/index.ts`, batch/receipt entity formatters, batch/discrepancy filters
  and tests, batch form date conversion.
- New route: `apps/web/src/app/receiving/new/page.tsx`.
- Docs: `docs/migration-history.md`, `docs/batches.md`, `docs/domain-glossary.md`,
  `docs/receipts.md`, `docs/scope.md`, `docs/authorization.md`,
  `docs/discrepancies.md`, `docs/piece-batches.md`, `docs/architecture.md`,
  `docs/frontend-architecture.md`, `docs/development.md`, `README.md`, `AGENTS.md`,
  `TODO.md`.
- Screenshots: `docs/screenshots/atv-057/`.

## Verification

**`npm run verify`** — passed (lint, Prisma validate, typecheck, contracts **99**,
web **290**, API **231**, Next/Nest builds; `/receiving/new` is in the built route
list).

Screenshots:

- `receiving-list.png` — `Gautos partijos`, `Priėmimas`, `Naujas priėmimas`.
- `new-receipt-entry.png` — entry form with `2026-11-18`.
- `date-filter-evidence.png` — inclusive `2026-11-18` range, `yyyy-mm-dd` values
  and `yyyy-mm-dd HH:mm` timestamps.
- `weight-label.png` / `weight-label-print.png` — WEIGHT label output.
- `piece-label.png` / `piece-label-print.png` — PIECE label output.
- `weight-confirmed.png` / `piece-confirmed.png` — confirmed batches.

## Known blockers

**None known that prevent receiving tomorrow’s goods.** The WEIGHT and PIECE paths
were completed end to end against the local dev database, including save, reopen,
location validation, labels and confirmation. The only test limitation is that no
physical printer was available/used; print output was checked in the browser and
via print media. Test data was removed after the walkthrough.
