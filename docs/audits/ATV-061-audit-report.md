# ATV-061 — Code, database and documentation audit

- **Date:** 2026-11-17
- **Status:** READY_FOR_HUMAN_REVIEW (uncommitted)
- **Scope:** the Aitvaras repository working tree only
- **Method:** working-tree inventory; Prisma/migration inspection and disposable
  replay; API/web usage tracing; unused-local checks; targeted dead-export
  review; documentation cross-check; browser smoke checks.

## 1. Starting state

Captured before any audit edit (saved outside the repository as
`atv-audit-start-status.txt`):

```text
M  87 files
?? 47 files/directories
D   1 file (apps/web/src/widgets/app-shell/ui/main-navigation.tsx)
```

The uncommitted work represented ATV-051…ATV-060 (piece batches, contextual
navigation, partner identification, receiving dates, dashboard stock summary,
pending-batch editing, notifications/Nustatymai/company settings). Nothing was
reset, discarded or reverted. All existing task records and screenshots were
preserved.

## 2. Database audit

### Evidence collected

- 22 migration folders and 22 applied rows in `_prisma_migrations`; every SQL
  file checksum matches the recorded checksum (22/22, zero drift, including the
  previously repaired `piece_batches` checksum).
- Full replay of all 22 migrations into a **disposable empty database**
  (`aitvaras_audit_replay`) succeeded; `prisma migrate status` reported
  “Database schema is up to date!”. The disposable database was dropped.
- `prisma migrate diff --from-config-datasource --to-schema
  prisma/schema.prisma` reported **“No difference detected.”**
- Exact row counts in the working database: 2 users, 2 user roles, 2 partners,
  7 packaging types, 2 warehouses, 5 locations, 13 deliveries, 23 batches,
  31 bags, 8 goods receipts, 8 receipt lines, 1 discrepancy, 3 settlements,
  1 company-settings row. No table was empty.
- The working database was not reset or modified by the audit.

### Findings and dispositions

| Finding | Evidence / location | Impact | Disposition |
|---|---|---|---|
| `goods_receipts` / `goods_receipt_lines` have no dedicated web UI | No `apiFetch` to `/receipts`; API module + e2e tests exist; batches reconcile through `Batch.receiptLineId` | Could look unused from the UI | **Retained.** Live rows, internal reconciliation anchor, documented confirmed receipt module. Deferred whether the standalone HTTP surface is still needed. |
| Many indexes show `idx_scan = 0` | `pg_stat_user_indexes` | Zero scans are not proof of disuse on a small/dev dataset | **Retained.** Indexes support FK lookups, filters and future volume; no drop justified. |
| `_prisma_migrations` checksum repair | `docs/migration-history.md`, current 22/22 comparison | No drift remains | **Verified**, no further action. |
| `company_settings` singleton | 1 row; fixed application id | No schema defect | **Retained.** |
| Schema header described old “packing forms” / homogeneous batches | `schema.prisma` header | Misleading durable comment | **Corrected** (piece batches, discrepancies, company settings, read-only stock projection). |

No tables or columns containing data were dropped.

## 3. Code and dependency audit

### Removed (clearly dead, no production references)

| Removed item | Evidence / location | Reason |
|---|---|---|
| `assertPieceBatchEditable`, `assertActivePackagingType`, `assertLocationInWarehouse` | `apps/api/src/modules/batches/batches.service.ts`; `tsc --noUnusedLocals`; only transactional variants are called | Superseded private helpers from earlier refactors. |
| `toPieceReconciliationLine` | `apps/api/src/modules/batches/batch.mapper.ts`; no imports/calls; duplicate of `toPieceReconciliationRow` | Duplicate mapper. |
| `apps/web/src/entities/receipt` (`formatReceiptDate`, `receiptUnitLabel`, `receiptLocationLabel`, `EMPTY_RECEIPTS_MESSAGE`) | Only tests referenced the dead helpers; `formatMoney` was the sole production export | Moved `formatMoney` to `shared/lib/format.ts` and deleted the obsolete entity slice. |
| `EMPTY_BATCHES_MESSAGE`, `isBatchOpen`, `bagLocationLabel` | `entities/batch/batch.ts`; only tests | Superseded list/status helpers. |
| `initialBagDraft` | `features/manage-batches/lib/batch-form.ts`; duplicate of the private `initialUnitDraft` | Duplicate draft logic. |
| `createDraftPackagingType`, `emptyResourceCategoryFormValues`, `partnerFormError` | Form libs; tests only; `partnerFormError` explicitly “legacy single-message helper” | Superseded form helpers. |
| Password-reset `error`/`success` state, `passwordResetPanelSuccess`, `PASSWORD_RESET_SUCCESS`, `userEditSuccess` | `features/manage-users/lib/users.ts`; outcomes now use the global toaster | Dead state/API after the notification convention. |
| `DISABLE_ACTION_CLASS`, `ENABLE_ACTION_CLASS`, `disableActionClass`, `enableActionClass` | `shared/lib/row-styles.ts`; tests only | `toggleActionClass` is the used API. |
| `DEFAULT_SURFACE_CLASS`, `defaultSurfaceClass` | `shared/lib/surfaces.ts`; tests only | Only the work surface is used. |
| `RECEIVING_MODES`, `RESOURCE_HEADING`, `ANOTHER_RESOURCE_LABEL`, `BAG_SURFACES`/`BagSurface`, `startAnotherResource`, `bagSurface`, `ADD_ITEM_LABEL` | `features/manage-batches/lib/receiving.ts`; tests only | Superseded receiving-state/label helpers. |
| `isLocationInWarehouse` | `entities/warehouse/warehouse.ts`; tests only | No UI/API consumer. |
| No-op `clearError` | `features/manage-batches/ui/batch-registration-editor.tsx` | Inline errors were migrated to toasts; the function did nothing. |

### Functional inconsistency fixed

**Confirmed-batch protection was inconsistent in the UI.** The receiving route
for a `CONFIRMED` batch showed an enabled “Nauja pakuotė” form and enabled
“Taisyti”/“Anuliuoti” row actions, even though the server correctly rejected
mutations with `409 BATCH_CONFIRMED`. The batch metadata editor was already
locked, but the package/item controls were not.

Fix: package/item creation forms and correction/void row actions are now
rendered only for `PENDING` batches. Reprint (`Spausdinti`) remains available.
Verified in the browser:

```text
PENDING WEIGHT   new package 1, Taisyti 1, Anuliuoti 1, Spausdinti 1
CONFIRMED WEIGHT new package 0, Taisyti 0, Anuliuoti 0, Spausdinti 3
CONFIRMED PIECE  new package 0, Taisyti 0, Anuliuoti 0, Spausdinti 1
```

### Dependencies, scripts, configuration

- No unused runtime/dev dependency was proven. `clsx`/`tailwind-merge` feed
  `cn`; `reflect-metadata` and `@nestjs/testing` are used; `tsx` runs scripts.
- **Command convention:** active docs use `npm run <script>`. Installation uses
  the pinned pnpm workspace manager because npm cannot resolve this pnpm
  workspace/lockfile. `package.json` still pins `pnpm@11.26.0`, the lockfile
  remains `pnpm-lock.yaml`, and root scripts internally use pnpm for workspace
  filtering. No CI configuration exists in the repository. No package-manager
  configuration migration was performed or needed for the documented commands.
- No unused environment variable was found: every `process.env` key is either
  documented in `.env.example` or generated by `next.config.ts`
  (`NEXT_PUBLIC_APP_VERSION`).
- No debug `console.log`/`debugger`/TODO/FIXME litter was found in source. The
  development-only `console.error` in the users page is deliberate diagnostics.
- No tracked logs, temporary files, patches or generated artifacts were found.
  `tsconfig.tsbuildinfo` is git-ignored and not tracked.

### Retained despite low/zero direct references

- `BAG_RECEIVING_FIELDS`, `FORMAL_RECONCILIATION_FIELDS`,
  `RESOURCE_SELECTION_FIELDS`, `DELIVERY_CONTEXT_FIELDS`: guarded by tests to
  keep documentary fields out of the worker flow; retained as explicit contracts.
- `GET /batches/by-barcode/:barcode`, `GET /batches/:id/bags`,
  `GET /batches/:id/items`, `GET /warehouses/:id/locations` and the `/receipts`
  goods-receipt endpoints: valid API surfaces used by tests or intended for
  scan/consumer use, even where the current UI uses a different read path.
- `activeLocations`, `isActiveSupplier`, `batchUnitsNewestFirst`: used internally
  or by tests as part of the entity/state model.
- Source-inspection tests that assert labels/field separation: retained as
  terminology/flow guardrails, not runtime code.

## 4. Harness and documentation audit

| Document | Correction |
|---|---|
| `README.md` | Status now includes company settings and the read-only stock summary; navigation reflects `Žinynai` children and `Nustatymai` → `Įmonė`/`Naudotojai`; workspace layout matches current modules; added stock/company docs links; command examples use the **npm convention** (`npm run <script>`), with dependency installation through the pinned pnpm workspace manager. |
| `AGENTS.md` | Scope/navigation corrected in ATV-060; stack/command rule now states the npm command convention while keeping the pinned pnpm workspace and lockfile. |
| `docs/architecture.md` | Updated status, module list (`stock`, `company-settings`), contracts list, model summary, 22-migration reference and implemented-module list. |
| `docs/development.md` | Replaced the outdated four-model list with the current confirmed model set; command examples use `npm run <script>`; installation remains with the pinned pnpm manager. |
| `docs/testing.md` | Corrected old example paths (`modules/auth`, `common/guards`). |
| `docs/backend-architecture.md` | Removed the false “no receipts module exists” claim and the outdated “future goods receipt” wording. |
| `docs/scope.md` | Added the dashboard stock summary as a read-only projection; kept stock balances/movements unconfirmed. |
| `docs/migration-history.md` | Commands standardised to the npm convention (`npm run <script>`), clarified historical counts and recorded the 22-migration replay/checksum audit. |
| `packages/database/prisma/schema.prisma` | Corrected the stale header comment only; no structural schema change in this audit. |

Task records: ATV-051…ATV-060 retained as historical evidence (including old
`Sistema`/receiving wording, which is intentional history). ATV-061 is added for
this audit. `tasks/current/` remains empty because this work is complete and
awaiting human review/commit. Screenshots under `docs/screenshots/atv-055…060`
are all referenced by task/docs records and retained.

## 5. Browser smoke check

Headless Chromium against local dev (`localdev`), 2026-11-17:

- **Dashboard:** `Suvestinė`; cards `Atsargos kilogramais` and
  `Atsargos vienetais`; no stock error alert.
- **New receiving:** `/receiving/new` renders `Naujas priėmimas` with supplier
  selection.
- **Pending batch editing:** `/receiving/G2611-04/batches/P01` shows prefilled
  supplier/warehouse and editable controls.
- **Confirmation:** pending batch detail exposes `Patvirtinti priėmimą`.
- **Confirmed protection:** confirmed batch shows the locked registration message,
  no edit link, no new-package form, no correction/void actions; reprint remains.
- **Labels/print preparation:** `Etiketė` opens `Etiketės peržiūra` with a
  rendered barcode and `Spausdinti`; the browser print dialog was **not**
  triggered and **no physical printer was tested**.
- **Partners/settings:** partner list (2 rows), `Įmonė` values persisted,
  `Nustatymai` tabs `Įmonė`/`Naudotojai`, users page (2 rows).
- **Console:** no application console errors (initial unauthenticated 401s
  filtered; the Next.js route announcer is not an application alert).

## 6. Verification

```text
npm run verify
  lint                 passed
  prisma validate      passed
  typecheck            passed (contracts, database, web, api)
  tests                contracts 104, web 283, API 244 — all passed
  build                passed (Next.js + NestJS)
```

Targeted checks: `tsc --noUnusedLocals` for web and API (clean); 22/22 migration
checksum match; disposable 22-migration replay; `prisma migrate diff` no
difference; `git diff --check` clean; no secret patterns added to the diff.

Test count fell from 301 to 283 because tests for removed dead helpers were
removed with them; no meaningful behaviour test was dropped.

## 7. Remaining technical debt / deferred

- The goods-receipt HTTP API (`/receipts`) has no current web consumer. It is
  retained because it backs the documented receipt module, data and batch
  reconciliation; decide later whether it remains a public API.
- Web route `/receipts` means the received-batch list, while API `/receipts`
  means goods receipts. This naming collision is retained to avoid a broad
  route/API rename in a cleanup task.
- Some read endpoints are unused by the current UI; they are retained for
  scan/consumer/test use rather than deleted speculatively.
- Zero-scan indexes are retained pending real-volume evidence.
- Physical printing was not verified; label preview only.

## 8. Commit/push readiness

No technical blocker to committing. Per task instruction, **nothing has been
committed or pushed**; the working tree is left ready for the subsequent
commit-and-push step and human review.
