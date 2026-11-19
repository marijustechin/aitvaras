# Piece batches (Vienetinės partijos)

> Status: **implemented** — a Batch is received either by **WEIGHT** (physical
> packages/weights, the original flow) or by **PIECE** (integer item lines of
> several products). The mode belongs to the concrete **Batch**, not to the
> resource: the same goods may be received differently in different purchases.

See also [batches.md](batches.md) (reconciliation), [discrepancies.md](discrepancies.md),
[resources.md](resources.md).

## Receiving mode (on the Batch)

`BatchReceivingMode`:

| Key | Lithuanian | Meaning |
|---|---|---|
| `WEIGHT` | Svorinė | one resource, physical packages, tare, gross/net weight, barcode per package |
| `PIECE` | Vienetinė | several product/resource item lines, integer quantities; no packages/weight |

- `WEIGHT` batches own exactly **one** resource (`Batch.resourceId` required). The
  existing weight flow is unchanged.
- `PIECE` batches own **no** batch-level resource (`Batch.resourceId` is `null`);
  their products live on the item lines. There is no fake "Mixed goods" resource.

`Batch.resourceId` is nullable; existing batches migrated to `WEIGHT`
(migration `20260930160000_piece_batches`).

## PIECE item lines (`BatchItem`)

A `BatchItem` is "this concrete product, this many pieces, at this location,
belonging to this purchase batch":

| Field | Notes |
|---|---|
| `barcode` | **globally-unique**, opaque EAN-13-shaped barcode identifying this counted inventory group |
| `batchId` | owning PIECE batch |
| `resourceId` | the product (reuses the `Resource` master) |
| `warehouseLocationId` | must belong to the batch's warehouse |
| `quantity` | positive whole number of pieces |
| `status` | `ACTIVE` / `VOIDED` |
| `voidedBy`/`voidedAt`/`voidReason` | traceable void (never hard-deleted) |

- One PIECE batch may contain **many different** resources.
- The same product may appear in **multiple locations**. Entering a product again
  creates a **separate group with its own barcode**; groups are never silently
  merged, and an existing barcode group is never mutated because resource/location
  match (traceability over clever deduplication).
- Physical package/barcode rows are **not** used for PIECE quantities.
- Batch totals (`itemLineCount`, `totalPieces`) are **server-derived** from the
  active lines; the client never supplies them.

### Barcode (counted inventory group)

The barcode reuses the existing opaque EAN-13 generation (GS1 `20` prefix + random
digits + check digit), is generated **server-side** and concurrency-safe (unique
column + retry), and encodes **no** business data. It identifies the concrete
**stock group** — scanning it resolves product, delivery, batch, original/current
quantity and location — and is **never** one barcode per individual piece. A group
of 30 pieces and a group of 70 pieces get two different barcodes.

### Cost / provenance pool

The PIECE batch is the commercial/provenance container: an item line belongs to a
batch `P01`, the batch belongs to a delivery `Gxxxx-xx`, and the batch carries the
total acquisition amount. The purchase value is **not** allocated to individual
product lines — no per-unit cost is derived here. Future sales/write-offs must
keep the `batchId` lineage explicit.

## Resumable batches and routes

A PIECE batch stays **editable until ADMIN confirms it**. Leave/re-enter does
**not** allocate a new batch: the batch has its own route
`/receiving/[deliveryId]/batches/[batchId]`, so re-opening restores its existing
groups. The delivery overview `/receiving/[deliveryId]` lists the batches in
`Priėmimo turinys`; each row links to its batch (whole-row link). New codes
(`P02`, `P03`, …) are created **only** by the explicit **`Nauja partija`**
action — never by returning to an existing batch. Browser Back/refresh/bookmark
work (route state, not ephemeral React state).

## Receiving UI

Inside an active delivery, the **`Nauja partija`** action first chooses
**`Partijos tipas`**: `Svorinė` or `Vienetinė`.

- **Svorinė** — `Išteklius` + `Sandėlis`, then the existing package/tare/weight
  flow.
- **Vienetinė** — `Sandėlis` only, then the piece screen: `Prekė`, `Kiekis, vnt.`,
  `Vieta`, actions `Išsaugoti` / `Išsaugoti ir spausdinti`, the entered group list
  (`Prekė`, `Kiekis`, `Vieta`, `Barkodas`, `Etiketė`/`Spausdinti`, correction
  actions) and `Iš viso: N vnt.` No tare/weight controls appear.

On desktop the entry form uses two aligned rows: `Prekė` gets the widest column
with `Kiekis, vnt.` and `Vieta` beside it, all controls the same height; below it,
`+ Nauja prekė` sits directly under the product selector at the same left edge
and width, while `Išsaugoti` and `Išsaugoti ir spausdinti` are right-aligned and
the same height. On mobile the reading order is preserved and the controls wrap.

`Prekė` is a **searchable selector**: typing narrows the existing products,
mouse/Enter/Arrow selection stores the product ID, and the field still requires a
selected product. `+ Nauja prekė` remains the explicit product-creation action.

`+ Nauja prekė` opens a minimal inline quick-create (name + category) so a worker
can create a missing product without leaving receiving; it uses the narrow
`POST /resources/receiving-quick-create` (ADMIN or warehouse worker, name +
category only). After creation the new product is selected in the form.

`Išsaugoti ir spausdinti` (and the `Spausdinti` reprint action on an existing
group) open a compact label containing `Priėmimas`, `Partija`, `Prekė`, `Kiekis`,
`Sandėlis`, `Vieta` and the barcode value + graphic. A reprint **never** creates
another group, barcode or batch.

While the batch is `PENDING`, a worker may **correct** an item's quantity/location
and **void** a line (kept for traceability). A `CONFIRMED` batch is frozen.

## Confirmation (itemised or single total)

ADMIN confirms a PIECE batch through `POST /batches/:id/confirm-piece` (a separate
form from the WEIGHT reconciliation). The UI preserves **both** documentary forms:

- **`Pagal prekes` (itemised)** — a table `Prekė | Faktiškai | Dokumentuose |
  Skirtumas`. `Faktiškai` is the server-derived sum of active item pieces for that
  resource (the same product in several groups/locations is one row); the ADMIN
  enters the documentary quantity per product. This is the default when the batch
  has more than one product.
- **`Bendras kiekis` (single total)** — one `Dokumentinis kiekis, vnt.` field for
  documents that provide only a total. This is the default for a single-product
  batch.

Both forms share `Įsigijimo vertė`, `Dokumento data` and `Dokumento Nr.`, use the
same unit everywhere (`Faktiškai gauta` / `Dokumentuose` / `Skirtumas`) and show
`—` for an empty documentary value. The quantity input is selected from the stored
`receivingMode` (not inferred from item lines), so it renders correctly before any
item is registered. Switching batches clears the stale draft values.

If every count matches, the batch confirms immediately. A mismatch opens the
acknowledgement dialog (`Patvirtinti priėmimą su neatitikimais?` for itemised,
`... su neatitikimu?` for a total) before confirming. On confirmation (one
transaction):

- the batch **acquisition amount** and document date/number are stored;
- itemised mode stores one `PieceReconciliationLine` per product and creates one
  **PIECE** `ReceivingDiscrepancy` per non-zero product row (with `resourceId`);
- total mode stores the aggregate `Batch.documentPieces` and creates one PIECE
  discrepancy for the batch when the total differs (without `resourceId`);
- the batch becomes `CONFIRMED`; group **barcodes are preserved** and the
  quantities become the baseline for future stock operations.

Confirmed groups become read-only through the receiving endpoints, including when
opened from a direct batch URL; active units can still reprint labels. An itemised
confirmation keeps its per-product `Dokumentuose` / `Skirtumas` table visible
read-only; a total confirmation shows the aggregate summary. A retry cannot
duplicate records (the batch-status flip guards the transaction).

## Cost pool (per-line allocation deferred)

The whole PIECE batch has **one** acquisition amount / cost pool (`Įsigijimo
vertė`), plus document date/number. A single total cannot be split across
heterogeneous products without an explicit allocation rule, so **line-level cost
allocation is intentionally deferred**. The system preserves the facts a later
allocation needs: the batch acquisition amount, actual pieces per product (item
lines), the aggregate documentary count and the resulting shortage/overage.
(Business consequence, not implemented now: a shortage on a product later
allocated a known cost means that cost is spread over fewer actual units, raising
the effective unit cost.)

## Receiving discrepancy boundary

An itemised PIECE confirmation creates one `ReceivingDiscrepancy` per non-zero
product row (with `resourceId`); a single-total confirmation creates **one** per
batch (without `resourceId`) when the totals differ. Both carry piece quantities
only — never fake weight values. PIECE discrepancies appear in the
`Ataskaitos → Neatitikimai` register and their **settlement is not defined yet**
(see [discrepancies.md](discrepancies.md)). WEIGHT discrepancy logic and
weight/money settlement are unchanged.

## API and authorization

| Capability | Endpoint | Requirement |
|---|---|---|
| Start a PIECE batch (`receivingMode: "PIECE"`, warehouse only) | `POST /deliveries/:id/batches` | `ADMIN` / `WAREHOUSE_WORKER` |
| Add an item line | `POST /batches/:id/items` | `ADMIN` / `WAREHOUSE_WORKER` |
| List item lines | `GET /batches/:id/items` | authenticated |
| Correct an item (quantity/location) | `PATCH /batches/:id/items/:itemId` | `ADMIN` / `WAREHOUSE_WORKER` |
| Void an item (traceable) | `POST /batches/:id/items/:itemId/void` | `ADMIN` / `WAREHOUSE_WORKER` |
| Confirm a PIECE batch | `POST /batches/:id/confirm-piece` | `ADMIN` |
| Quick-create a product from receiving | `POST /resources/receiving-quick-create` | `ADMIN` / `WAREHOUSE_WORKER` |

Server-side invariants: a WEIGHT batch requires a resource and rejects item
lines; a PIECE batch rejects packages (`BATCH_NOT_WEIGHT`) and requires only the
warehouse; quantities are integers `> 0`; locations must belong to the batch's
warehouse; a `CONFIRMED` batch is immutable through the receiving endpoints.

## Inventory semantics

Both receiving modes produce **barcode-addressable stock objects** tied to a batch,
a location and provenance:

- **WEIGHT** — the barcode identifies one physical weighted **package**.
- **PIECE** — the barcode identifies one homogeneous counted **inventory group**
  (one product + quantity at one location within one batch).

Future move/sale/write-off operations will operate **against these barcodes**
(later slices); this task does not implement those operations.

## Admin display

`Priėmimas` and the batch detail show the mode (`Svorinė`/`Vienetinė`). WEIGHT
continues to show package count/net weight; PIECE shows the product line count and
total pieces (no meaningless `0 kg`).

## Out of scope / not implemented

- Piece-count discrepancy logic.
- Per-unit/per-line cost allocation from the batch acquisition amount.
- A second product master (the existing `Resource` master is reused).
- Label/barcode printing for PIECE (piece receiving has no physical packages).
