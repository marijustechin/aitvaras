# ATV-059 — Edit PENDING receiving batches

- **Status:** done (uncommitted; for human review)
- **Scope:** clear edit entry point, PENDING-only batch/receipt/unit corrections, confirmation/concurrency protection
- **Depends on:** batch/detail/registration flows; confirmed-batch protection (ATV-057/058)

## Objective

Let warehouse users correct an existing **PENDING** batch from its detail page
without creating another receipt/batch, while keeping confirmed batches and
concurrent confirmation safe.

## Implemented

### Entry point and scope

- `Redaguoti partiją` action beside the batch heading on
  `/receipts/batches/[id]`, only while `PENDING` and for receiving roles.
- Opens the existing registration route
  `/receiving/[deliveryId]/batches/[batchId]`, prefilled with the saved receipt,
  batch, bags and piece items. IDs, codes and unit barcodes are unchanged.
- After `Išsaugoti pakeitimus`, returns to the same batch detail page.
- List filters persist in `sessionStorage` under
  `aitvaras.priemimas.filters.v1`, so returning from detail/edit restores them.

### Editable information

- **Receipt scope:** supplier + arrival date; clearly labelled as applying to the
  whole receipt. Multiple batches are indicated. These fields are disabled and
  rejected by the API if any sibling batch is confirmed.
- **Batch scope:** WEIGHT resource; warehouse for both modes. If active units
  exist and the warehouse changes, a target location of the new warehouse is
  required and active units are relocated; bag `LOCATION` corrections are
  recorded. Barcodes stay stable.
- **WEIGHT units:** existing add/correct/void; correction includes packaging/tare
  type, gross weight and location; net weight is recalculated server-side.
- **PIECE units:** correction now includes resource, quantity and location;
  adding/voiding reuse the existing forms and barcode identities.
- No WEIGHT↔PIECE conversion was introduced.

### Save, cancel, confirmation

- `Išsaugoti pakeitimus` / `Atšaukti` for receipt/batch metadata. Save leaves the
  batch `PENDING`; cancel discards the metadata form. Unit operations retain their
  existing immediate save/cancel panels.
- A dirty metadata form triggers a browser `beforeunload` warning on refresh/close.
- `Patvirtinti priėmimą` stays a separate ADMIN action on the detail page.
- Totals/labels refresh from saved records; reprint keeps the same barcode.

### Backend protection

- New `PATCH /batches/:id/registration` (`ADMIN` / `WAREHOUSE_WORKER`), contract
  `UpdateBatchRegistrationRequest`.
- Receipt shared-field changes are rejected with
  `DELIVERY_HAS_CONFIRMED_BATCHES` when a sibling is confirmed.
- `PATCH /batches/:id/items/:itemId` accepts `resourceId` for PENDING PIECE lines.
- All add/correct/void/registration mutation paths now lock the batch row
  (`SELECT … FOR UPDATE`) and re-check `PENDING`. Registration also locks all
  delivery batches. An edit after confirmation returns `409 BATCH_CONFIRMED`
  without writing; the UI refreshes the status.
- Unique `(delivery, resource, warehouse)` conflicts map to a Lithuanian
  `BATCH_ALREADY_EXISTS` conflict.

## Verification results

### WEIGHT (`ATV059 Test Supplier`; test rows removed afterwards)

- Metadata changed without a new batch: same `id`/`deliveryId`/code; resource
  `AFRIKA MIX → DOROTHY PERKINS`, warehouse `GAMYBA → senas Produkcija`, arrival
  `2026-11-18 → 2026-11-19`; both bag barcodes unchanged and both relocated.
- Added a missing bag (`+3.5 kg gross`), corrected a bag (`12 kg gross → 11.2 kg
  net`, location changed) and voided a mistaken bag (`4.45 kg net`).
- Pending edits did **not** affect dashboard stock
  (`8 884 kg / 6 609 €`, `30 vnt. / 300 €` before and after).
- Confirmation: total **13.9 kg**; dashboard weight delta **+13.9 kg**, value delta
  **+50 €**, pieces delta 0.
- After confirmation: registration/bag update/bag add all returned
  `409 BATCH_CONFIRMED`; stored gross remained `12`.

### PIECE (`ATV059 Test Supplier`; test rows removed afterwards)

- Corrected a line's resource, quantity (`5 → 6`) and location; added a missing
  line (2 pcs) and voided a mistaken line (4 pcs) via the existing controls.
- Pending edits did not affect dashboard stock.
- Confirmation: **8 pcs**; dashboard pieces delta **+8**, value delta **+40 €**,
  weight delta 0.
- After confirmation: registration/item update/item add all returned
  `409 BATCH_CONFIRMED`; quantity remained `6`.

### Concurrency / filters

- API integration test runs a registration edit and confirmation concurrently and
  asserts the receipt is either edited before confirmation or the edit is rejected,
  with no partial mutation.
- Returning from detail restored the selected supplier and `Visos` status filter.

## Files changed

- Contracts: `batches.ts` (item `resourceId`), `incoming-deliveries.ts`
  (`UpdateBatchRegistrationRequest`).
- API: `batches.controller.ts`, `batches.service.ts` (registration endpoint,
  transactional locks, relocation, PIECE resource corrections).
- Web: `batch-registration-editor.tsx`, receiving delivery/batch detail pages,
  batch list filter persistence, batch-form piece correction resource, tests.
- Docs: `docs/batches.md`, `TODO.md`.
- Screenshots: `docs/screenshots/atv-059/`.

## Verification

**`npm run verify`** — passed: lint, Prisma validate, typecheck, tests
(contracts **99**, web **291**, API **244**), builds.

Screenshots:

- `edit-entry-point.png` — `Redaguoti partiją` beside the heading.
- `edit-form-prefilled.png` — populated receipt/batch edit form.
- `edit-corrected-detail.png` — corrected metadata/locations and audit trail.
- `edit-units-added-voided.png` — added/corrected/voided WEIGHT entries.
- `piece-edit-form-prefilled.png`, `piece-edit-units.png` — PIECE correction.
- `edit-confirmed-detail.png`, `piece-edit-confirmed.png` — confirmed results.
- `filters-restored.png` — list filters preserved after returning.

## Known limitations

- Unit add/correct/void are immediate existing operations with their own
  save/cancel; the new `Išsaugoti pakeitimus`/`Atšaukti` pair covers receipt/batch
  metadata. This preserves the proven registration workflow rather than creating a
  second draft engine.
- No schema or migration change. Changes remain uncommitted.
