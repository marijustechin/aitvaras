# ATV-062 — Clarify discrepancy settlement source batch

- **Status:** READY_FOR_HUMAN_REVIEW (uncommitted)
- **Scope:** discrepancy settlement semantics, UI wording, validation and tests
- **Related:** `docs/discrepancies.md`; ATV-050 settlement ledger

## Discovered meaning

`DiscrepancySettlement.sourceBatchId` is **not** the original discrepancy batch
and is **not** derived from the opened discrepancy. The discrepancy already owns
`batchId`; the settlement field was an optional `WEIGHT` link to a **separate,
later confirmed batch of replacement goods**. The original batch is excluded by
the UI and is never required from the user.

The previous label **“Susijusi partija”** was ambiguous: it could read as the
original batch being selected again, even though the backend already resolves the
original batch from the opened discrepancy.

## Implemented

- Kept the relationship as a replacement-goods link (the accurate meaning) and
  renamed the selector and history column to
  **“Papildomai gautų prekių partija”**.
- Added the explanation: “Pasirinkite partiją, su kuria tiekėjas pristatė
  trūkstamas prekes.”
- The replacement selector is shown only for `WEIGHT` (physical quantity)
  settlement; monetary settlement does not show or require it.
- The original batch remains fixed by the opened discrepancy; no automatic
  substitution into the replacement field.
- Backend now rejects:
  - the original discrepancy batch as the replacement (`SOURCE_BATCH_SAME_AS_ORIGINAL`);
  - any replacement link on `MONEY` settlements (`SOURCE_BATCH_NOT_ALLOWED_FOR_MONEY`).
- Existing validations remain: replacement batch must exist, be `CONFIRMED`, and
  belong to the same supplier.
- Historical settlements are untouched; existing links still render.
- Partial settlement, outstanding balance, over-settlement protection and the
  append-only ledger are unchanged.
- Settlement never creates or duplicates stock; the linked replacement batch
  already owns its receiving stock.

## Corrected form

```text
Būdas: [Svoriu] [Pinigais]
Padengiamas svoris, kg: [____]

WEIGHT only:
Papildomai gautų prekių partija: [— Nepasirinkta — / confirmed replacement batches]
Pasirinkite partiją, su kuria tiekėjas pristatė trūkstamas prekes.

MONEY only:
Suma: [____]   Valiuta: [EUR]

Nuoroda / dokumento Nr.: [____]
Pastaba: [____]
```

The original batch is shown separately in the immutable origin summary and is
never a value in the replacement selector.

## Tests / verification

- API e2e covers: valid replacement link, same-as-original rejection,
  pending/other-supplier/missing rejection, money-with-replacement rejection,
  historical link preservation, bag-count unchanged after settlement, monetary
  settlement, partial settlement and over-settlement protection.
- `npm run verify` in the clean npm copy passed:
  contracts **104**, web **283**, API **245**; lint, typecheck and builds passed.
- The corrected form was browser-verified against the running app: the
  `Papildomai gautų prekių partija` selector and explanation appear for
  `Svoriu`, and disappear when `Pinigais` is selected; the money fields appear
  instead. Screenshots:
  `docs/screenshots/atv-062/settlement-form-weight.png` and
  `settlement-form-money.png`.
- `git diff --check` passes.

## Files changed

- `packages/contracts/src/receiving-discrepancies.ts`
- `apps/api/src/modules/receiving-discrepancies/receiving-discrepancies.service.ts`
- `apps/api/test/receiving-discrepancies.e2e.test.ts`
- `apps/web/src/features/manage-discrepancies/ui/discrepancy-details-page.tsx`
- `docs/discrepancies.md`

## Remaining notes

- The internal database/API field name `sourceBatchId` is retained for
  compatibility; its user-facing meaning is now explicit.
- Linking a replacement batch does not move or duplicate inventory.
