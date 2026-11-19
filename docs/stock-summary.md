# Dashboard stock summary

> Status: **implemented read model** (ATV-058). This does **not** introduce stock
> balances, stock movements, lots or a new costing system. It aggregates the
> already-confirmed receiving data for the dashboard.

## Cards

| Card | `Kiekis` | `Vertė` |
|---|---|---|
| `Atsargos kilogramais` | active packages' actual net weight (`kg`) | remaining acquisition cost + current applied receipt expenses of confirmed WEIGHT batches (EUR) |
| `Atsargos vienetais` | active PIECE item lines' remaining pieces (`vnt.`) | remaining acquisition cost + current applied receipt expenses of confirmed PIECE batches (EUR) |

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
- Value uses the implemented cost fields: `Batch.acquisitionAmount` (EUR) plus the
  batch's **current applied** `allocatedTransportAmount` and
  `allocatedCustomsAmount`, added **once per confirmed batch**, never per bag/item
  line. This prevents duplicated costs; multiple bags/lines do not multiply the
  batch cost.
- Receipt-level transport/customs expenses are applied per receipt through an
  auditable ledger (see
  [batches.md](batches.md#receipt-level-transport-and-customs-expenses-priėmimo-išlaidos)).
  The valuation reads only the batch's **current applied** shares, regardless of
  how they were derived: net weight for all-WEIGHT, pieces for all-PIECE, or the
  mixed receipt's recorded acquisition value in EUR (with `Po lygiai` available
  when that basis is missing/zero). A pending sibling's share is never included. A
  late invoice or revised amount may update a confirmed batch's share; stock value
  changes by the **difference** only, while physical quantity, confirmation and
  discrepancy history stay intact. Reapplying identical amounts has no effect, so
  the same expense is never counted twice.
- Batches confirmed before this feature (or receipts with no applied allocation)
  have `allocatedTransportAmount = null` and `allocatedCustomsAmount = null`;
  their value remains exactly `acquisitionAmount`.
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

## Historical verification data (ATV-058, 2026-11-17)

Captured before the ATV-065 development-data cleanup; it is not the current
development database state.

Source database, confirmed batches only:

- WEIGHT: 8 confirmed batches; 21 active bags = **8 884,000 kg**;
  acquisition values total **6 609,00 €**.
- PIECE: 1 confirmed batch; 1 active item line = **30 vnt.**;
  acquisition value **300,00 €**.
- Excluded PENDING stock: 1 372 kg and 960 pieces (not present in the cards).
- Cost is summed once per batch, so the 21 bags/8 batches produce 6 609,00 €,
  not a per-bag multiple.

Screenshots: `docs/screenshots/atv-058/`.
