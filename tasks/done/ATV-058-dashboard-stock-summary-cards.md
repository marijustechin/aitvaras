# ATV-058 — Dashboard stock summary cards

- **Status:** done (uncommitted; for human review)
- **Scope:** dashboard read-only stock summary over confirmed receiving data
- **Depends on:** confirmed batch/bag/item model (ATV-057 and earlier)

## Objective

Replace the dashboard’s large introductory action panel with two stock summary
cards while keeping `Naujas priėmimas` as a compact primary action. Quantities and
remaining values must come from confirmed stock only, be aggregated in the API,
and never be silently shown as zero when valuation or the request fails.

## Implemented

- Dashboard (`Suvestinė`) now shows two cards:
  - **Atsargos kilogramais** — `Kiekis` in actual net kg, `Vertė` in EUR.
  - **Atsargos vienetais** — `Kiekis` in pieces, `Vertė` in EUR.
- Cards are side by side from `md`; stacked on mobile.
- Compact primary `Naujas priėmimas` action remains beside the heading for
  receiving roles (existing `homeShowsReceivingAction` rule).
- Money uses Lithuanian formatting with explicit two decimals; weight uses
  Lithuanian grouping and `kg`; pieces use Lithuanian grouping and `vnt.`.
- Loading and error states show `—` placeholders, never zero. Empty stock shows
  explicit zeros. Incomplete valuation shows a `*` and
  `* Dalies atsargų vertė nenurodyta.`

## Backend

New authenticated read endpoint `GET /stock/summary` (`StockModule`):

- WEIGHT quantity: `SUM(Bag.netWeight)` for `Bag.status=ACTIVE` on
  `Batch.status=CONFIRMED` and `receivingMode=WEIGHT`.
- PIECE quantity: `SUM(BatchItem.quantity)` for `BatchItem.status=ACTIVE` on
  `Batch.status=CONFIRMED` and `receivingMode=PIECE`.
- Value: `Batch.acquisitionAmount` added **once per confirmed batch** with active
  units. Multiple bags/item lines never duplicate cost. No sale price and no new
  valuation method.
- Missing `acquisitionAmount` keeps quantity, returns known subtotal (or `null`)
  and `valuationIncomplete=true`; missing cost is never converted to zero.
- `PENDING` batches and `VOIDED` bags/items are excluded.
- No stock-movement table exists yet, so remaining stock = active units of
  confirmed batches; historical receipts are not summed. This limitation is
  documented in `docs/stock-summary.md`.
- Permissions unchanged: authenticated users only, same visibility as batch
  quantities/acquisition values; no new role gate.

## Verification results

Source data (development database, 2026-11-17), confirmed only:

| Card | Source | Displayed |
|---|---|---|
| Atsargos kilogramais | 8 confirmed WEIGHT batches, 21 active bags, net sum 8 884.000 kg; acquisition total 6 609.00 € | `8 884,000 kg` / `6 609,00 €` |
| Atsargos vienetais | 1 confirmed PIECE batch, 1 active line, 30 pcs; acquisition 300.00 € | `30 vnt.` / `300,00 €` |

Excluded unconfirmed stock: PENDING batches contribute 1 372 kg and 960 pcs; the
cards match confirmed-only totals.

Controlled API delta test (temporary DB rows removed afterwards):

- PENDING WEIGHT batch with two bags → summary unchanged.
- Confirming it (status transition, cost 25.00) → `+6.500 kg`, `+25.00 €`; two
  bags did not double the value.
- PENDING PIECE batch with two lines (3 + 2) → summary unchanged.
- Confirming it (cost 40.00) → `+5 vnt.`, `+40.00 €`; two lines did not double the
  value.
- Weight and piece cards remained independent.

UI states verified in the browser:

- Real data: cards match API totals.
- Empty response: `0,000 kg` / `0,00 €` and `0 vnt.` / `0,00 €`.
- Failed request: visible error and card values `—` (not zero).
- Loading: `Kraunama atsargų suvestinė…` and `—` card values.
- Incomplete valuation: quantity retained, value `—*` / known value `*`, footnote
  shown.
- Mobile: cards stacked vertically.

## Files changed

- Contracts: `packages/contracts/src/stock.ts`, `index.ts`.
- API: `modules/stock/stock.module.ts`, `stock.controller.ts`, `stock.service.ts`,
  `stock-summary.ts` + unit tests; `app.module.ts`.
- Web: `features/home/ui/home-page.tsx`; `entities/batch/batch.ts` (Lithuanian
  piece grouping); `entities/receipt/receipt.ts` (explicit two-decimal money).
- Docs: `docs/stock-summary.md`, `docs/architecture.md`, `TODO.md`.
- Screenshots: `docs/screenshots/atv-058/`.

## Verification

**`npm run verify`** — passed: lint, Prisma validate, typecheck, tests
(contracts **99**, web **290**, API **237**), builds.

Screenshots:

- `dashboard-stock-cards.png` — both cards with source totals.
- `dashboard-stock-cards-mobile.png` — stacked mobile layout.
- `dashboard-stock-empty.png`, `dashboard-stock-loading.png`,
  `dashboard-stock-error.png`, `dashboard-stock-incomplete.png` — states.

## Known limitations

- No stock-movement ledger exists yet; remaining stock is therefore the active
  units of confirmed batches. When movements are introduced, they must reduce
  these quantities before valuation.
- The batch `acquisitionAmount` is the only implemented cost pool; no per-unit
  allocation or sale-price valuation is invented.
