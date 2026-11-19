# ATV-074 — Required-field highlighting and aligned manager batch toggles

Status: **READY_FOR_HUMAN_REVIEW** (uncommitted, together with ATV-066…073).

## Objective

Make empty required manager-confirmation fields immediately visible, move
`Dokumento duomenys` under `Prekė`, keep summary columns aligned, and verify the
confirmation target with an isolated WEIGHT P01 + multi-product PIECE P02 receipt.

## Implemented

### Field-level required validation

- Reused the confirmation rules through shared helpers in `batch-form.ts`:
  - `isDocumentaryWeightValid` — positive decimal;
  - `isAcquisitionAmountValid` — non-negative decimal (`0` valid);
  - `isPieceCountValid` — non-negative whole number (`0` valid).
- When a pending batch is expanded, each empty/invalid required input gets a red
  border immediately:
  - WEIGHT: documentary weight and acquisition value;
  - PIECE `Pagal prekes`: every product `Dokumentuose` input independently;
  - PIECE `Bendras kiekis`: the single total input.
- The border clears as soon as the value satisfies the rule and returns when the
  value is cleared. A recorded `0` clears the border only where the existing rule
  allows it (acquisition and piece counts; not documentary weight).
- Required fields carry `aria-required="true"` and `aria-invalid`, so the state is
  available to assistive technology.
- Optional `Dokumento data` / `Dokumento Nr.` stay neutral without required/invalid
  attributes.

### Toggle placement and alignment

- `Dokumento duomenys` now sits directly below `Prekė`, like the arrow in the
  reported screenshot, using the same compact outlined button, chevron, pointer
  cursor and keyboard focus ring as `Rodyti prekes`.
- Multi-product PIECE batches keep `Rodyti prekes` below the product count. Both
  controls open the same panel, so each batch has exactly one expansion toggle.
- The summary header now matches the bordered group's content inset, so all
  batches share the same column positions as their headings on desktop.
- `Būsena / veiksmas` contains only the status or collapsed `Patvirtinti PXX`
  action. When expanded, the single confirmation button stays below that batch's
  inputs inside its border.

## Files changed

- `apps/web/src/features/manage-batches/ui/receipt-manager-page.tsx`
- `apps/web/src/features/manage-batches/lib/batch-form.ts`
- `apps/web/src/features/manage-batches/lib/batch-form.test.ts`
- `apps/web/src/features/manage-batches/lib/batch-list.test.ts`
- `docs/batches.md`
- `TODO.md`
- `docs/screenshots/atv-074/`
- this record

## Decisions

- **One validation source.** Border state uses the same helpers as confirmation
  validation, so a cleared border always means the field is submittable.
- **Only expanded pending batches show required errors.** Collapsed rows remain
  compact and do not display errors before the manager opens the batch.
- **One toggle per batch.** The `Prekė` cell owns the only expansion control;
  the action column stays reserved for status/confirmation.
- **Invalid, not just empty.** A non-empty value that still violates the existing
  required rule also gets the red border, matching what confirmation would reject.

## Verification

- `npm run verify` passed: lint, `db:validate`, typecheck, tests and builds.
  - API: 27 files / **272** tests.
  - Web: 31 files / **296** tests.
  - Contracts: 15 files / **104** tests.
- Isolated receipt `G2611-10`:
  - pending WEIGHT `P01` — PRIMARK, 10,000 kg;
  - pending multi-product PIECE `P02` — EuroMix 4 vnt. and Lego 3 vnt.
- Browser verification:
  - Collapsed P01/P02: no red borders; both toggles sat directly below the product
    / product count; each batch had exactly one toggle.
  - Summary column left positions for `Partija`, `Prekė`, `Priimta`,
    `Dokumentuose`, `Skirtumas`, `Įsigijimo vertė, €` and `Būsena / veiksmas`
    matched the heading positions for both P01 and P02.
  - Keyboard Tab reached `Dokumento duomenys` with a visible focus ring.
  - Expanded P01: weight and acquisition were red and `aria-required`; date and
    number stayed neutral. Weight `10` and acquisition `0` cleared their borders;
    clearing the weight restored the red border.
  - Expanded P02: both product rows and the acquisition were red. Entering `3` in
    one product cleared only that row; the other product and acquisition stayed
    red.
  - Collapsing and reopening P02 preserved the entered `3` and its cleared border.
  - Completing P02 and clicking its bottom-right action sent
    `POST /batches/{P02}/confirm-piece` with the entered product quantities;
    P01 stayed `PENDING`, P02 became `CONFIRMED`, and the receipt list showed
    `1 iš 2`.
- Screenshots in `docs/screenshots/atv-074/`:
  `manager-required-fields-desktop.png`,
  `manager-p02-partial-desktop.png`,
  `manager-required-fields-mobile.png`,
  `receipt-after-p02-confirm-desktop.png`.

## Live data

- The isolated `G2611-10` fixture was deleted after verification.
- No existing live receipt was modified.

## Unresolved / deliberately out of scope

- Required highlighting appears only while a pending batch is expanded; collapsed
  rows do not pre-emptively show errors.
- Invalid optional dates remain subject to the existing confirmation message; they
  are not part of the required-field red-border rule.
- No API validation rules were changed.

## Recommended next task

Human review and commit of ATV-066…074. Any further manager-screen validation or
layout change needs a new confirmed task.
