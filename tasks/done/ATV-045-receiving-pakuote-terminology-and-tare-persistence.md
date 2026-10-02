# ATV-045 — Receiving `Pakuotė` terminology and tare-selection persistence

- **Status:** done (uncommitted; for human review)
- **Scope:** narrow receiving UX terminology/persistence follow-up
- **Depends on:** ATV-042…ATV-044 (receiving / packaging slice)

## Objective

Use the generic user-facing term **`Pakuotė`** instead of the bag-specific
`Maišas` in the active receiving UI, and stop forcing the worker to reselect the
`Tara` after every saved package. No domain-architecture, reconciliation, tare
calculation or barcode change; the internal `Bag` model/API/module is **not**
renamed.

## 1. Terminology

Active receiving UI wording replaced (internal `Bag` names unchanged):
`Naujas maišas` → **`Nauja pakuotė`**; `Partijos maišai` → **`Partijos
pakuotės`**; `Maišai` headers → **`Pakuotės`** (`Gavimo turinys`, `Gavimai` queue
`Pakuotės / kiekis`, detail `Pakuotės / svoris`); `Anuliuoti maišai` →
**`Anuliuotos pakuotės`**; `Anuliuoti maišą` → `Anuliuoti pakuotę`; `Koreguoti
maišą` → `Koreguoti pakuotę`; notices/errors use `pakuotė`; home text updated.
`Tara` remains the PackagingType selector label. (`Maišas` remains only as a valid
PackagingType **name** example in tests.)

## 2. Tare-selection persistence

After `Išsaugoti` / `Išsaugoti ir spausdinti`, the active delivery, batch/resource,
selected `Tara` and suggested location are preserved; only the gross weight is
cleared. Repeated similar package registration is fast.

## 3. Server-derived suggestion

`BatchDetail.suggestedPackagingTypeId` added, derived from the batch's **latest
active** package (same pattern as `suggestedLocationId`); `null` when the batch has
no active package. The next-package draft uses it, so the selection survives a
refresh/re-entry and is not local-component-only. A voided package never becomes
the suggestion, and inactive packaging is not newly selectable.

## 4. New-resource reset

`Kitas išteklius` starts a new batch without a `Tara` selection
(`suggestedPackagingTypeId` null); once its first package is saved, that batch
suggests its own tare. Packaging preference is batch-specific.

## 5. Counts/summaries

Summary headings use `Pakuotės`; the count still means the number of **active**
physical packages (voided excluded) via `bagCount`.

## Files changed

- Contracts: `batches.ts` (`BatchDetail.suggestedPackagingTypeId`).
- API: `modules/batches/batches.service.ts` (derive the suggestion).
- Web: `features/manage-batches/lib/{receiving.ts,batch-form.ts}` (+tests),
  `ui/{receiving-page.tsx,gavimai-page.tsx,batch-details-page.tsx}`,
  `features/home/ui/home-page.tsx`, `features/manage-batches/lib/batch-list.test.ts`,
  `entities/batch/batch.ts`.
- API tests: `test/batches.e2e.test.ts` (suggestion behaviour).
- Docs: `batches.md`, `packaging-types.md`, `domain-glossary.md`, `TODO.md`; this
  record.

No schema/migration change (the suggestion is derived, not stored).

## Verification

- `pnpm verify` green: lint, Prisma validate, typecheck, contracts **80** / web
  **207** / API **202**, Next + Nest builds.
- `git diff --check` clean.
- `prisma migrate diff` — no difference (no schema change).
- `/sandelys` untouched; no commit/push.

## Known limitations

- Internal `Bag`/`Maišas` naming still present (deferred rename).
- The suggestion reflects the latest active package's selection, not an arbitrary
  per-worker preference (as required).
