# Dashboard stock summary

> Status: **implemented read model** (ATV-058). This does **not** introduce stock
> balances, stock movements, lots or a new costing system. It aggregates the
> already-confirmed receiving data for the dashboard.

## Cards

| Card | `Kiekis` | `Vertė` |
|---|---|---|
| `Atsargos kilogramais` | active packages' actual net weight (`kg`) | remaining acquisition cost of confirmed WEIGHT batches (EUR) |
| `Atsargos vienetais` | active PIECE item lines' remaining pieces (`vnt.`) | remaining acquisition cost of confirmed PIECE batches (EUR) |

- Cards are side by side from `md`; stacked on mobile.
- Monetary values use Lithuanian formatting with two decimals.
- Weight uses Lithuanian grouping and three decimals (`8 884,000 kg`); pieces use
  Lithuanian grouping (`30 vnt.`).
- Zero eligible stock displays `0,000 kg` / `0,00 €` and `0 vnt.` / `0,00 €`.
- Loading and error states show placeholders (`—`), never zero.

## Data rules

- Only `Batch.status = CONFIRMED` contributes. `PENDING` (draft/unconfirmed) and
  cancelled/voided units never contribute.
- Remaining quantity:
  - WEIGHT: `SUM(Bag.netWeight)` for `Bag.status = ACTIVE` (actual net, gross −
    agreed tare snapshot) on confirmed WEIGHT batches.
  - PIECE: `SUM(BatchItem.quantity)` for `BatchItem.status = ACTIVE` on confirmed
    PIECE batches.
- Current remaining quantity is the active confirmed units. There is **no stock
  movement table yet**; no historical receipt rows are summed. If movement
  records are introduced, they must reduce these quantities before valuation.
- Value uses the only implemented cost field, `Batch.acquisitionAmount` (EUR),
  added **once per confirmed batch**, never per bag/item line. This prevents
  duplicated costs; multiple bags/lines do not multiply the batch cost.
- No sale price and no new valuation method are used.
- If an included batch has no `acquisitionAmount`, its quantity is still included
  and the card shows the known value (or `—` if none) with `*` and
  `* Dalies atsargų vertė nenurodyta.` — missing costs are never silently zero.
- Aggregation is done in the API over all matching rows, independent of any list
  pagination.
- Permissions are unchanged: authenticated users who can already read batch
  quantities/acquisition values can read this summary. No new role gate is
  added.

## API

`GET /stock/summary` (authenticated):

```json
{
  "weight": { "quantityKg": "8884", "value": "6609", "valuationIncomplete": false },
  "pieces": { "quantity": 30, "value": "300", "valuationIncomplete": false }
}
```

`value` is `null` only when stock exists but no valuation is known. Zero stock
returns `"0"`. Decimal strings are formatted by the web client.

## Verification data (2026-11-17)

Source database, confirmed batches only:

- WEIGHT: 8 confirmed batches; 21 active bags = **8 884,000 kg**;
  acquisition values total **6 609,00 €**.
- PIECE: 1 confirmed batch; 1 active item line = **30 vnt.**;
  acquisition value **300,00 €**.
- Excluded PENDING stock: 1 372 kg and 960 pieces (not present in the cards).
- Cost is summed once per batch, so the 21 bags/8 batches produce 6 609,00 €,
  not a per-bag multiple.

Screenshots: `docs/screenshots/atv-058/`.
