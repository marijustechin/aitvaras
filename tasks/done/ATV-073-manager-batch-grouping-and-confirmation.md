# ATV-073 — Make the confirmed batch unmistakable on the manager receipt screen

Status: **READY_FOR_HUMAN_REVIEW** (uncommitted, together with ATV-066…072).

## Objective

Prevent an operator from entering P01 documentary quantities and accidentally
confirming P02 by making every batch's expanded contents and confirmation action
unambiguously belong to that batch, and verify the reported mistake with isolated
data.

## Implemented

### Findable product toggle

- A multi-product PIECE batch now shows a compact outlined
  `Rodyti prekes` / `Slėpti prekes` button with a chevron.
- The button uses the shared outline style, shows a pointer cursor, updates
  `aria-expanded`, references its expanded panel with `aria-controls`, and has a
  visible `focus-visible` ring.
- Collapsed rows stay compact; single-product/WEIGHT rows keep a compact
  `Dokumento duomenys` text toggle.

### One continuous batch group

- The manager list is no longer a shared table. Each batch is its own bordered
  group, so the summary row, document fields, product table and confirmation
  action all sit inside one continuous border.
- An expanded group gets a subtle muted background and a stronger border. The
  next batch starts outside that border with a visible gap.
- PIECE products are labelled `PXX prekės` using the actual batch code.
- Mobile renders each group as a wrapping two-column summary with labelled fields;
  the expanded panel and product table stay inside the group.

### One code-labelled confirmation per pending batch

- A collapsed pending batch shows `Patvirtinti P01` on its summary row.
- Expanding moves the same single action to the bottom-right of that group,
  immediately after its document/product inputs; the summary row then shows no
  duplicate confirmation.
- Every action uses the batch code (`Patvirtinti P02`, etc.) and carries an
  accessible `Patvirtinti partiją PXX` name.
- The discrepancy dialog names the same batch:
  `Patvirtinti P02 su neatitikimu?` and `Taip, patvirtinti P02`.
- Confirmed groups are read-only: no confirmation/edit inputs, but active units
  and details remain inspectable.

## Files changed

- `apps/web/src/features/manage-batches/ui/receipt-manager-page.tsx`
- `apps/web/src/features/manage-batches/lib/batch-list.test.ts`
- `docs/batches.md`
- `docs/stock-summary.md`
- `TODO.md`
- `docs/screenshots/atv-073/`
- this record

## Decisions

- **A batch is the visual unit.** Group borders replace shared table rows so an
  expanded batch cannot visually flow into its neighbour.
- **The code is part of every confirmation action.** A generic
  `Patvirtinti partiją` label is too easy to associate with the wrong row.
- **One action, two positions.** Exactly one confirmation button exists per
  pending batch: summary when collapsed, bottom-right when expanded.
- **No behaviour change to confirmation.** The request still targets the batch ID
  bound to that group; only discoverability and grouping changed.

## Verification

- `npm run verify` passed: lint, `db:validate`, typecheck, tests and builds.
  - API: 27 files / **272** tests.
  - Web: 31 files / **294** tests.
  - Contracts: 15 files / **104** tests.
- Isolated fixture: `G2611-09` with multi-product PIECE `P01`
  (Dulkių siurblys 3 vnt., Lego 4 vnt.) above pending WEIGHT `P02`
  (EuroMix 10,000 kg).
- Browser verification:
  - Collapsed P01: `Rodyti prekes`, `aria-expanded="false"`, outlined 1 px
    border, chevron, pointer cursor, and a visible focus ring after keyboard Tab.
  - Expanded P01: `Slėpti prekes`, `aria-expanded="true"`, heading `P01 prekės`,
    summary/fields/table/action all inside the P01 group; P02 began 12 px below
    the P01 border.
  - Exactly one `Patvirtinti P01` button, positioned below the product inputs;
    P02 kept its own `Patvirtinti P02`.
  - Entered P01 documentary quantities 3 and 4, then clicked the P01 button
    directly below the table. The `POST /batches/{P01}/confirm-piece` request
    targeted P01 and carried both entered quantities; P02 received no request.
  - After confirmation: P01 `CONFIRMED` with 3/4 persisted and read-only, P02
    still `PENDING`, and `/receipts` showed `1 iš 2`.
  - P02 discrepancy dialog: `Patvirtinti P02 su neatitikimu?` and
    `Taip, patvirtinti P02`.
- Screenshots in `docs/screenshots/atv-073/`:
  `manager-batch-group-desktop.png` (expanded P01 action plus start of P02),
  `manager-batch-group-mobile-full.png` (mobile grouping),
  `receipt-after-p01-confirm-desktop.png` (P01 confirmed/read-only, P02 pending).

## Documentation review

- `docs/stock-summary.md` corrected from “frozen receipt expenses” to the
  implemented **current applied** shares, and now states that valuation uses the
  applied shares regardless of how they were derived: net weight, pieces, or a
  mixed receipt's acquisition value. The late-invoice rule remains: a confirmed
  batch changes by the valuation difference only, while quantities and history stay
  intact.

## Live data

- The isolated `G2611-09` fixture was deleted after verification.
- No existing live receipt was modified; operator data remains untouched.

## Unresolved / deliberately out of scope

- Confirmed batches remain inspectable but read-only.
- Single-product PIECE and WEIGHT batches keep the compact text toggle rather than
  `Rodyti prekes`; the requirement's product toggle targets multi-product batches.
- No change to acquisition/expense rules or batch confirmation APIs.

## Recommended next task

Human review and commit of ATV-066…073. Any further manager-screen change needs a
new confirmed task.
