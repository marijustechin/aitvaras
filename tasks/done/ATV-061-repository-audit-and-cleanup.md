# ATV-061 — Repository audit and cleanup

- **Status:** READY_FOR_HUMAN_REVIEW (uncommitted)
- **Scope:** working-tree audit of code, database/migrations and project docs;
  justified dead-code cleanup only
- **Audit report:** `docs/audits/ATV-061-audit-report.md`
- **Depends on:** ATV-051…ATV-060 uncommitted work

## Goal

Audit the accumulated uncommitted work for obsolete implementation,
inconsistencies and development artifacts; remove only proven dead code; verify
database history; correct stale documentation; run the canonical gate and browser
smoke checks. Do not commit or push.

## Starting state

Captured before edits: 87 modified files, 47 untracked files/directories and one
deleted legacy navigation file. No work was reset, discarded or reverted.

## Work performed

### Database

- All 22 migrations replayed successfully into a disposable empty database;
  disposable database dropped afterwards.
- 22/22 migration SQL checksums match `_prisma_migrations`; no drift.
- `prisma migrate diff` against the working schema: **no difference detected**.
- Exact row counts recorded; no table was empty. No table/column with data was
  dropped. Zero-scan indexes retained (not proof of disuse).
- Corrected the stale Prisma header comment only; no schema change.

### Code

- Removed dead API private guards and a duplicate PIECE mapper.
- Removed the obsolete `entities/receipt` slice; moved its only live helper
  (`formatMoney`) to `shared/lib/format.ts`.
- Removed superseded web helpers/state: batch list/location helpers,
  `initialBagDraft`, form factories, `partnerFormError`, password-reset inline
  message state/success helpers, row-style aliases, default surface helper,
  receiving-state/label helpers, `isLocationInWarehouse`, and a no-op
  `clearError`.
- Fixed a real UI inconsistency: confirmed batches no longer show enabled
  new-package/item forms or correction/void actions; reprint remains available.
- No unused dependency, environment variable, debug output or tracked generated
  artifact was proven.

### Documentation

Corrected README, architecture, development, testing, backend-architecture,
scope, migration-history and the schema header. Active command examples now use
the npm convention (`npm run <script>`); installation stays with the pinned pnpm
workspace manager and no package-manager/lockfile migration was performed.
Preserved all historical task records and referenced screenshots. Added
`docs/audits/ATV-061-audit-report.md` and this record; updated `TODO.md`.

## Verification

- `npm run verify` — passed: lint, Prisma validate, typecheck, tests
  (contracts **104**, web **283**, API **244**) and builds.
- Targeted `tsc --noUnusedLocals` for web and API: clean.
- Migration checksum comparison 22/22; disposable replay 22/22; migrate diff
  clean.
- Browser smoke: dashboard cards; new receiving; pending-batch edit; pending
  confirmation control; confirmed-batch locked/no edit/no mutation actions;
  label preview + barcode + print button; partners; `Įmonė`; `Naudotojai`; no
  application console errors. No physical printer was tested.
- `git diff --check` clean; no secret patterns added.

## Files changed (audit-specific)

- `apps/api/src/modules/batches/batches.service.ts`, `batch.mapper.ts`
- `apps/web/src/entities/**` (receipt removed; batch/warehouse helpers trimmed)
- `apps/web/src/features/**` (form/state/helper cleanup; confirmed-batch UI
  gating)
- `apps/web/src/shared/lib/{format,row-styles,surfaces}.ts` + tests
- `apps/web/src/features/manage-batches/ui/receiving-delivery.tsx`
- `README.md`, `docs/architecture.md`, `docs/backend-architecture.md`,
  `docs/development.md`, `docs/testing.md`, `docs/scope.md`,
  `docs/migration-history.md`, `packages/database/prisma/schema.prisma` comment
- `docs/audits/ATV-061-audit-report.md`, `TODO.md`, this record

## Findings / limitations

- `/receipts` API (goods receipts) has no current web consumer; retained because
  it is documented, populated and used by batch reconciliation.
- Web `/receipts` (batch list) and API `/receipts` (goods receipts) naming
  collision retained; too broad to rename during cleanup.
- Some read endpoints and zero-scan indexes retained pending real usage/volume
  evidence.
- Physical print was not verified; only label preview/print preparation.

## Unresolved / next

Human review of the audit report and full diff, then commit and push the combined
ATV-051…061 package. No technical blocker to committing; nothing was committed or
pushed per task instruction.
