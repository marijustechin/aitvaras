# ATV-072 — PIECE entry layout/search, read-only confirmed receiving and mixed acquisition allocation

Status: **READY_FOR_HUMAN_REVIEW** (uncommitted, together with ATV-066…071).

## Objective

1. Align the PIECE entry form and make `Prekė` searchable.
2. Open fully/partially confirmed receipts and confirmed batches in read-only mode,
   based on actual status rather than the selected list filter.
3. Support `Pagal vertę` allocation for mixed kg/vnt. receipts using the recorded
   acquisition value, while keeping `Po lygiai` available and preserving physical
   quantities.

## Implemented

### PIECE entry form

- Desktop two-row layout: `Prekė` (widest), `Kiekis, vnt.` and `Vieta` share one
  row with aligned labels and 40 px controls; below it `+ Nauja prekė` sits at the
  product selector's left edge and width, while `Išsaugoti` /
  `Išsaugoti ir spausdinti` are right-aligned with the same height.
- Mobile keeps the reading order and wraps the controls.
- `ITEM_RESOURCE_LABEL` is now `Prekė`.
- New `ProductCombobox` filters existing products while typing and supports mouse,
  `Enter` and arrow-key selection; the stored value is the existing product ID.
  `+ Nauja prekė` remains the explicit creation action.

### Read-only confirmed receiving

- The operational receipt derives `allConfirmed` from the batches themselves, not
  from the list filter. A fully confirmed receipt hides `Nauja partija` and shows
  `Priėmimas patvirtintas. Duomenų keisti negalima; …`.
- Batch rows still open contents; active units keep `Spausdinti` for label
  reprinting; no add/correct/void or `Redaguoti partiją` controls appear on a
  confirmed batch.
- A partially confirmed receipt keeps pending batches editable, while each
  `CONFIRMED` row opens read-only.
- Direct operational URLs to confirmed batches render the same read-only view.
  Server-side physical-change checks remain authoritative.
- The manager `Peržiūrėti` action still opens `/receipts/[deliveryId]`; workers see
  no manager action and retain operational access.
- Receipt-level transport/customs revisions stay available to ADMIN through the
  manager screen.

### Mixed kg/vnt. expense allocation

- `BY_VALUE` basis is derived from the eligible batches:
  - all WEIGHT → actual net kg, helper `Pagal partijų neto svorį.`;
  - all PIECE → actual pieces, helper `Pagal priimtą vienetų kiekį.`;
  - mixed WEIGHT + PIECE → recorded acquisition amount in EUR, helper
    `Pagal partijų įsigijimo vertę eurais.` (no kg + vnt. denominator).
- Proportional reservation is available for a mixed receipt when every eligible
  batch has a recorded acquisition amount and their sum is positive. `0,00 €` is a
  valid zero share.
- Missing value: preview names the batch (`Trūksta įsigijimo vertės: P02.`),
  `Po lygiai` stays available, and apply is rejected with
  `ACQUISITION_BASIS_UNAVAILABLE`.
- All values zero: preview explains that the proportional basis is zero;
  `Po lygiai` remains available.
- The UI no longer forces `EQUAL` or rejects mixed receipts; the blanket
  `MIXED_RECEIPT_REQUIRES_EQUAL` rejection is removed from the API.
- Preview and apply share one `allocateExpenses` calculation; transport and customs
  are allocated separately to the cent with largest-remainder rounding.
- The preview shows each batch's `Įsigijimo vertė, €` and proposed shares while
  previous applied allocations remain until an explicit revision.
- Contract additions: `acquisitionAmount`, `basis`, `proportionalAvailable`,
  `proportionalBlockedReason`.

## Files changed

- `apps/web/src/features/manage-batches/ui/product-combobox.tsx` (new)
- `apps/web/src/features/manage-batches/ui/receiving-delivery.tsx`
- `apps/web/src/features/manage-batches/lib/receiving.ts`
- `apps/web/src/features/manage-batches/ui/delivery-expenses.tsx`
- `apps/api/src/modules/batches/expense-allocation.ts` (new)
- `apps/api/src/modules/batches/expense-allocation.test.ts` (new)
- `apps/api/src/modules/batches/batches.service.ts`
- `apps/api/test/delivery-expenses.e2e.test.ts` (new)
- `packages/contracts/src/delivery-expenses.ts`
- `docs/batches.md`, `docs/piece-batches.md`, `docs/scope.md`,
  `docs/domain-glossary.md`
- `TODO.md`
- `docs/screenshots/atv-072/`
- this record

## Decisions

- **Acquisition value is the only mixed proportional basis.** Kilograms and pieces
  cannot share a denominator; a recorded EUR amount is comparable across both.
- **Missing is not zero.** Only an explicitly recorded `0,00 €` is a zero share;
  a missing value blocks `Pagal vertę` and is named in the message.
- **Status, not filter, governs actions.** A confirmed receipt is read-only even
  when reached from an `Visos`/`Patvirtinta` filter, a direct URL or a worker view.
- **Server stays authoritative.** The UI hides controls, while existing batch
  status checks still reject physical changes.
- **Search keeps the existing product ID.** The combobox is a selector, not a
  free-text product name; creation remains the explicit `+ Nauja prekė` flow.

## Verification

- `npm run verify` passed: lint, `db:validate`, typecheck, tests and builds.
  - API: 27 files / **272** tests.
  - Web: 31 files / **293** tests.
  - Contracts: 15 files / **104** tests.
- Browser verification (isolated receipts and a temporary worker):
  - Desktop PIECE form: product 496 px, quantity/location 242 px, all 40 px high;
    `+ Nauja prekė` matched the product selector's left edge/width; save buttons
    40 px and right-aligned.
  - Mobile layout preserved reading order and wrapped.
  - Typing `Lego` filtered the selector to `Lego`; keyboard selection saved the
    existing product ID and the saved item appeared in the batch.
  - ADMIN fully confirmed receipt: G… opened `/receiving/[deliveryId]`,
    `Peržiūrėti` opened `/receipts/[deliveryId]`, the read-only message appeared,
    `Nauja partija` was absent, and the confirmed batch showed `Spausdinti` but no
    `Nauja pakuotė`.
  - Worker fully confirmed receipt: no `Peržiūrėti`; the G… code still opened the
    operational read-only page.
  - Mixed receipt: applied `Po lygiai` (1 000 € / 175 € each), then `Pagal vertę`
    with 2 000 € transport / 350 € customs over acquisition values 6 000 € and
    4 000 €. Preview and apply produced 1 200 € / 210 € (60 %) and 800 € / 140 €
    (40 %); the ledger recorded previous/new shares only; physical quantities stayed
    240 vnt. and 1 214 kg. Reapplying the same result was a no-op.
  - Missing acquisition: `Trūksta įsigijimo vertės: P02.` shown; `Po lygiai`
    remained available.
  - All-zero acquisition: `Įsigijimo verčių suma lygi 0…` shown.
- Screenshots in `docs/screenshots/atv-072/`:
  `piece-entry-desktop.png`, `piece-entry-mobile.png`,
  `confirmed-receipt-readonly-desktop.png`,
  `confirmed-worker-readonly-desktop.png`,
  `mixed-acquisition-preview-desktop.png`,
  `mixed-acquisition-applied-desktop.png`,
  `mixed-missing-acquisition-desktop.png`,
  `mixed-zero-acquisition-desktop.png`.

## Live data

- Isolated fixtures `G2611-09`…`G2611-13` and the temporary worker user were
  removed after verification.
- Live receipts observed before/after the task (`G2611-01`, `-04`, `-06`, `-07`)
  were not modified; the operator's ongoing data remains untouched.

## Unresolved / deliberately out of scope

- No proportional denominator combining kilograms and pieces; acquisition value is
  required for mixed `Pagal vertę`.
- A mixed receipt without recorded acquisition values must use `Po lygiai` or wait
  for the values to be recorded.
- No automatic reallocation when a batch's acquisition value later changes; the
  manager applies an explicit revision.
- Scan-driven movements, split/merge, settlement reversal and cost redistribution
  remain unconfirmed and are not implemented.

## Recommended next task

Human review and commit of ATV-066…072. Any further receiving change needs a new
confirmed task.
