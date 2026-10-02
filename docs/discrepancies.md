# Neatitikimai — receiving discrepancy register and settlement ledger

> Status: **implemented** — the long-lived receiving discrepancy register
> (`ReceivingDiscrepancy`) and its append-only settlement ledger
> (`DiscrepancySettlement`). It lives independently of batch confirmation and
> **never** changes physical inventory.

See also [batches.md](batches.md) (reconciliation creates a discrepancy),
[receipts.md](receipts.md), [domain-glossary.md](domain-glossary.md).

## What a discrepancy is

When a batch is **confirmed** with a documentary/physical weight mismatch, a
`ReceivingDiscrepancy` is recorded (see
[batches.md](batches.md#reconciliation-formal-confirmation)). The batch is
`CONFIRMED` and the physical stock stays the measured net weight; the mismatch
lives on independently in the register.

Immutable signed convention:

```text
differenceWeight = measuredWeight − documentWeight
```

| Example | differenceWeight | Direction |
|---|---|---|
| measured 980, document 1000 | `−20 kg` | `Trūkumas` (shortage) |
| measured 1020, document 1000 | `+20 kg` | `Perteklius` (overage) |

The signed difference is **never** changed after creation. Both shortages and
overages use the same ledger; no separate overage-return/write-off workflow exists
yet.

## Settlement ledger

`DiscrepancySettlement` entries are **append-only** — there is no delete/edit UI.
A future correction/reversal would be a separate audited workflow, not a silent
rewrite.

| Field | Meaning |
|---|---|
| `type` | `WEIGHT` or `MONEY` |
| `coveredWeightKg` | amount of the **original magnitude** this entry resolves; **always positive**, in kg, **never signed** |
| `moneyAmount` / `currency` | for `MONEY` only |
| `sourceBatchId` | optional `WEIGHT` link to the later confirmed batch that physically covers it |
| `reference` / `note` | optional free text |
| `createdBy` / `createdAt` | who/when |

`coveredWeightKg` is **not** derived from money and money is **never** converted
to/from kg. The ADMIN explicitly enters both how much discrepancy weight is
covered and (for `MONEY`) how much money was received/credited.

## WEIGHT settlement

- requires `coveredWeightKg > 0`;
- optional `sourceBatchId`, `reference`, `note`.

If `sourceBatchId` is supplied it must exist, be `CONFIRMED`, and belong to the
**same supplier** as the discrepancy (error codes `SOURCE_BATCH_NOT_FOUND`,
`SOURCE_BATCH_NOT_CONFIRMED`, `SOURCE_BATCH_SUPPLIER_MISMATCH`).

A `WEIGHT` settlement **does not add stock**. The additional physical stock
already belongs to the later receiving batch; the settlement only records that
some of that later supply was agreed to cover the earlier discrepancy. No
inventory quantity is reallocated.

## MONEY settlement

- requires `coveredWeightKg > 0`;
- requires `moneyAmount > 0` and a `currency` (the UI offers `EUR` by default).

No `moneyAmount / kg` ratio is calculated and `coveredWeightKg` is never inferred
from money.

## Balance and status

Derived server-side, never trusted from the client:

```text
originalWeight  = |differenceWeight|
settledWeight   = Σ settlements.coveredWeightKg
remainingWeight = originalWeight − settledWeight
```

| Status | Condition | Lithuanian |
|---|---|---|
| `OPEN` | no settlement exists | Atviras |
| `PARTIALLY_SETTLED` | `settledWeight > 0` and `remainingWeight > 0` | Dalinai padengtas |
| `SETTLED` | `remainingWeight == 0` | Padengtas |

`settledAt` is set the first time the discrepancy becomes fully settled.

Creation is **transactional**: the discrepancy row is locked, the already-settled
weight is re-derived, the new entry is rejected if it would exceed the remaining
magnitude (`SETTLEMENT_EXCEEDS_REMAINING`), then the entry is inserted and the
status/`settledAt` updated. Concurrent requests therefore cannot over-settle.

## Inventory boundary

A settlement **must not and does not**:

- change any bag/physical package weight;
- change the batch's measured weight;
- create or remove inventory;
- change the original document weight;
- reopen receiving confirmation.

It is a supplier discrepancy-resolution ledger only.

## API and authorization

| Capability | Endpoint | Requirement |
|---|---|---|
| List the register | `GET /receiving-discrepancies` | authenticated |
| Discrepancy detail (immutable origin + balance + settlements) | `GET /receiving-discrepancies/:id` | authenticated |
| Record a settlement | `POST /receiving-discrepancies/:id/settlements` | `ADMIN` |

The register returns derived `direction`, `originalWeight`, `settledWeight`,
`remainingWeight` and `status`; the detail adds the settlement history. Filtering
(status/supplier/resource/direction/date/delivery code) is currently client-side.

## Navigation / IA

Under **`Ataskaitos`** → **`Neatitikimai`**:

- `/reports/discrepancies` — the ADMIN register;
- `/reports/discrepancies/[id]` — the discrepancy detail.

ADMIN only; `WAREHOUSE_WORKER` does not see the reporting group. Server
authorization remains authoritative.

## Register / detail / settlement UI

- Register heading `Neatitikimai`; columns `Data`, `Gavimas`, `Partija`,
  `Tiekėjas`, `Išteklius`, `Tipas`, `Neatitikimas`, `Padengta`, `Likutis`,
  `Būsena`. The original difference is shown signed (`−20,000 kg` / `+12,500 kg`)
  with direction `Trūkumas` / `Perteklius`.
- Filters: status (default `Atviri`), supplier, resource, direction, date
  from/to, delivery-code search, and `Atstatyti filtrus`. **No default date range**
  is imposed, so old unresolved discrepancies stay visible.
- Detail shows the immutable origin summary, the balance
  (`Pradinis neatitikimas` / `Padengta` / `Likutis`) and `Padengimų istorija`.
- While not `SETTLED`, the detail offers the `Registruoti padengimą` form
  (`Būdas` `Svoriu`/`Pinigais`, `Padengiamas svoris, kg`, optional
  `Susijusi partija` for `WEIGHT`, `Suma` + `Valiuta` for `MONEY`, optional
  `Nuoroda`/`Pastaba`). When `SETTLED` the form is hidden and `Padengtas` is shown.

## Out of scope / not implemented

- Reversal/correction of a settlement (would be an audited workflow).
- Overage-specific return/write-off/document-adjustment semantics.
- Money↔weight conversion.
- Server-side register filtering/pagination.
