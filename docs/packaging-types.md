# Packaging / tare (Tara)

> Status: **implemented** — administrator-managed master data and the **canonical
> physical-packaging master data** (the former, overlapping `Pakavimo forma` /
> `PackingForm` concept was removed, ATV-049). A physical handling unit references
> one packaging type; its tare weight is subtracted from the entered gross weight
> to derive the net weight (the measured stock quantity). A zero tare is valid
> where physically appropriate (e.g. a metal cage or a roll).

## What a Tara is

A **Tara** (`PackagingType`) is a managed packaging/tare type (e.g. `Maišas`,
`EPAL` pallet). It has a name, a precise `tareWeightKg` (Decimal 14,3 — never
floating point) and an active flag. It is the packaging that a physically received
package is carried in.

Examples:

| Name | Taros svoris |
|---|---|
| `Maišas` | `0.800 kg` |
| `EPAL` | `27.000 kg` |

## Relationship to handling units

Every physical handling unit (`Bag`) references exactly one `PackagingType` and
stores:

- `packagingTypeId` (required; `ON DELETE RESTRICT`);
- `grossWeight` (the value the worker enters);
- `tareWeightKg` (an immutable/current **snapshot** of the tare actually used);
- `netWeight` (computed server-side);
- `warehouseLocationId`;
- `barcode`.

**Rule:** `netWeight = grossWeight − tareWeightKg`. The net weight is **always**
computed by the server; a client-provided net weight is never trusted. At
registration (and on a packaging correction) the server copies the then-current
`PackagingType.tareWeightKg` into `Bag.tareWeightKg`, so
`grossWeight − tareWeightKg = netWeight` stays true **historically** even if the
PackagingType master record is edited later. Historical net is never derived from
the live master value.

Reads/labels: the packaging **name** may come from the referenced PackagingType,
but the displayed **tare weight**, gross and net always come from the Bag itself.

**Repeated entry:** within an active batch the selected `Tara` is remembered via
the server-derived `suggestedPackagingTypeId` (the latest **active** package), so
the worker does not reselect it after every save; only the gross weight is cleared.
A `Kitas išteklius` batch starts without a selection (packaging preference is
batch-specific).

Rejected on new registration:

- gross weight `<= 0`;
- gross weight `<= tare` (`GROSS_NOT_ABOVE_TARE`);
- an **inactive** packaging type (`PACKAGING_INACTIVE`).

Historical packages may continue referencing an **inactive** packaging type (it is
deactivated, never deleted).

## Totals and reconciliation

All inventory/reconciliation measured totals use **netWeight**, not gross weight.
Gross and tare values are preserved on the package for traceability. The
documentary piece count is unaffected.

## Corrections

Correction of an active package allows changing the **packaging type**, the
**gross weight** and the **location**. After a packaging-type or gross-weight
change the server recomputes `netWeight`; when the packaging type changes it also
re-snapshots the new tare into `Bag.tareWeightKg`. It appends `PACKAGING` /
`GROSS_WEIGHT` (and/or `LOCATION`) rows to the existing `BagCorrection` audit
trail; the `PACKAGING` row records the previous/new packaging name **and tare**
(e.g. `Maišas (0.800 kg) → EPAL (27.000 kg)`), so the previous and new tare/gross/
net state stays understandable. History is never silently overwritten. The batch's
measured total updates accordingly.

## Administration

Smallest ADMIN management API/UI, consistent with the other master-data pages:

| Capability | Endpoint | Requirement |
|---|---|---|
| List packaging types | `GET /packaging-types` | authenticated |
| Packaging-type detail | `GET /packaging-types/:id` | authenticated |
| Create | `POST /packaging-types` | `ADMIN` |
| Edit name / tare / active | `PATCH /packaging-types/:id` | `ADMIN` |

No hard delete: a referenced packaging type is deactivated. The UI is at
`/resources/packaging-types` (linked from `Ištekliai` as **`Tara`**).

## Migration / historical provenance

The `drop_packing_forms` migration (ATV-049) removed the redundant `PackingForm`
concept and preserved any distinct legacy packing-form names (e.g. `Metalinis
narvas`, `Rulonas`) as `PackagingType` rows with tare `0.000` — matched by exact
name, so no duplicate packaging type is created. Names already present as a
`PackagingType` were left untouched.

Existing handling units have no known packaging/tare. They are attached to a
dedicated, **inactive** `Nežinoma tara` row with `tareWeightKg = 0.000`, so
`netWeight = grossWeight = the stored weight` without inventing a tare, and the row
cannot be chosen for new receiving. This is the explicit historical-provenance
strategy; see `docs/batches.md` (migration note).

## Related documents

- [batches.md](batches.md) — receiving, gross/net weights and reconciliation
- [domain-glossary.md](domain-glossary.md) — `Tara`, `Maišas`
- [resources.md](resources.md) — other referenced master data
