# Receiving inventory — method

> Status: **procedure** (documentation only). Companion baseline:
> [receiving-inventory-before.md](receiving-inventory-before.md).
> A later redesign repeats this procedure and produces
> `receiving-inventory-after.md` plus a comparison by stable ID.

## 1. Purpose

Produce a reproducible description of the Aitvaras **receiving** workflow as it
exists at a chosen baseline, so that after a redesign the two versions can be
compared row by row and the differences used to find obsolete code, duplicate
workflows and historical compatibility requirements.

The inventory is **not** a specification and **not** a plan. It records what the
code and the UI do today, including behaviour nobody wants to keep.

## 2. Scope

### 2.1 Start and end points

Start at the `Priėmimas` destination (`/receipts`) and follow receiving through:

1. **Web** — routes, screens, controls, client-side derivations and messages.
2. **API** — controllers, route handlers, guards, validation pipes.
3. **Contracts** — Zod schemas and shared enums in `packages/contracts`.
4. **Database** — Prisma models, columns, constraints and migrations.
5. **Downstream** — stock valuation, discrepancies, settlements, labels,
   expense allocation and any shared helper whose other callers matter.

### 2.2 Included directories/files

```text
apps/web/src/app/receipts/**
apps/web/src/app/receiving/**
apps/web/src/app/reports/discrepancies/**
apps/web/src/features/manage-batches/**
apps/web/src/features/manage-discrepancies/**
apps/web/src/entities/batch/**
apps/web/src/entities/receiving-discrepancy/**
apps/web/src/entities/packaging-type/**
apps/api/src/modules/batches/**
apps/api/src/modules/stock/**
apps/api/src/modules/receiving-discrepancies/**
apps/api/src/modules/receipts/**            (internal GoodsReceipt model + API)
apps/api/src/modules/packaging-types/**     (tare master data used by packages)
packages/contracts/src/{batches,incoming-deliveries,delivery-expenses,
  receiving-discrepancies,stock,receipts,packaging-types}.ts (+ their tests)
packages/database/prisma/schema.prisma
packages/database/prisma/migrations/**/migration.sql   (receiving-related only)
apps/api/test/{batches,piece-batches,delivery-expenses,receiving-discrepancies,
  receipts,packaging-types}.e2e.test.ts
```

Shared helpers (`shared/ui`, `shared/lib`, `entities/*`) are **not** fingerprinted;
record their receiving callers and any caller outside receiving instead.

### 2.3 Excluded

- secrets: `.env*`, credentials, tokens, DSNs;
- local configuration, editor/OS files;
- database **contents** (never dump rows; read-only schema/migrations only);
- generated output: `.next/`, `dist/`, `node_modules/`, coverage, logs;
- screenshots and other binaries (reference them by path, do not hash them);
- unrelated modules (partners, resources, warehouses, auth, users) — except where
  receiving depends on them, in which case record the dependency, not the module.

## 3. Baseline capture (exact procedure)

Run from the repository root (`aitvaras`).

```powershell
# 1. Version identity
git rev-parse --abbrev-ref HEAD
git rev-parse HEAD
git log -1 --date=iso-strict --format="%H%n%ad%n%s"

# 2. Working-tree identity (the baseline includes uncommitted work)
git status --porcelain=v1
git diff --stat

# 3. Untracked receiving-related files (from the same status output)
git status --porcelain=v1 | Select-String '^\?\?'
```

Record `branch`, `HEAD`, the full `git status --porcelain=v1` output and the
`git diff --stat` totals. A commit hash alone is **not** a baseline when the tree
is dirty.

### 3.1 Fingerprint

The fingerprint is a sorted list of `sha256  relative/path` lines over the files
in §2.2, plus one aggregate digest = SHA-256 of the sorted lines joined by `\n`
(UTF-8, no trailing newline). PowerShell procedure actually used:

```powershell
$root=(Get-Location).Path
$targets=@(
 'apps/web/src/app/receipts',
 'apps/web/src/app/receiving',
 'apps/web/src/app/reports/discrepancies',
 'apps/web/src/features/manage-batches',
 'apps/web/src/features/manage-discrepancies',
 'apps/web/src/entities/batch',
 'apps/web/src/entities/receiving-discrepancy',
 'apps/web/src/entities/packaging-type',
 'apps/api/src/modules/batches',
 'apps/api/src/modules/stock',
 'apps/api/src/modules/receiving-discrepancies',
 'apps/api/src/modules/receipts',
 'apps/api/src/modules/packaging-types',
 'packages/database/prisma/schema.prisma'
)
$files=@()
foreach($t in $targets){
  $p=Join-Path $root $t
  if(Test-Path -LiteralPath $p -PathType Container){ $files += Get-ChildItem -LiteralPath $p -Recurse -File }
  elseif(Test-Path -LiteralPath $p){ $files += Get-Item -LiteralPath $p }
}
foreach($c in @('batches.ts','incoming-deliveries.ts','delivery-expenses.ts',
  'receiving-discrepancies.ts','stock.ts','receipts.ts','packaging-types.ts','index.ts',
  'batches.test.ts','incoming-deliveries.test.ts','batch-items.test.ts',
  'receiving-discrepancies.test.ts','receipts.test.ts','packaging-types.test.ts')){
  $p=Join-Path $root "packages/contracts/src/$c"
  if(Test-Path -LiteralPath $p){ $files += Get-Item -LiteralPath $p }
}
$files += Get-ChildItem -LiteralPath (Join-Path $root 'apps/api/test') -File |
  Where-Object { $_.Name -in @('batches.e2e.test.ts','piece-batches.e2e.test.ts',
    'delivery-expenses.e2e.test.ts','receiving-discrepancies.e2e.test.ts',
    'receipts.e2e.test.ts','packaging-types.e2e.test.ts') }
$files += Get-ChildItem -LiteralPath (Join-Path $root 'packages/database/prisma/migrations') `
  -Recurse -File -Filter 'migration.sql' |
  Where-Object { $_.FullName -match 'incoming_deliveries|batch_reconciliation|receiving_batches_and_bags|handling_unit|packaging_types|receiving_discrepancies|discrepancy_settlements|piece_batches|piece_reconciliation|delivery_expenses|expense_application_ledger|batch_delivery_local_code|optional_receipt_location|warehouse_placement|drop_packing_forms' }

$rows = $files | Sort-Object -Property FullName -Unique | ForEach-Object {
  $h=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLower()
  $rel=$_.FullName.Substring($root.Length+1).Replace('\','/')
  "$h  $rel"
}
$rows | Set-Content -LiteralPath "$env:TEMP\aitvaras-receiving-fingerprint.txt" -Encoding utf8
$agg=[System.Security.Cryptography.SHA256]::Create().ComputeHash(
  [System.Text.Encoding]::UTF8.GetBytes(($rows -join "`n")))
"count: $($rows.Count)"
"aggregate: " + ([BitConverter]::ToString($agg).Replace('-','').ToLower())
```

The two-argument `Sort-Object -Property FullName -Unique` and the explicit path
list are part of the procedure: a different set of targets produces a different
aggregate even if every individual hash is unchanged.

The path list is part of the fingerprint: adding, removing or renaming a file
changes both the list and the aggregate. Paths are repository-relative with `/`
separators so the digest is portable across machines.

## 4. Stable IDs

IDs describe **behaviour**, never files. Format:

```text
RCV-<AREA>-<NN>
```

| Area | Covers |
|---|---|
| `NAV` | entry points, links, redirects, role gates, direct-URL-only routes |
| `LIST` | receipt list: grouping, filters, pagination, row actions |
| `RCPT` | receipt lifecycle: create, empty receipt, header, delete, read-only |
| `BATCH` | batch lifecycle: resolve, code, edit, detail, concurrency |
| `PHYS` | WEIGHT physical receiving: packages, tare, net, corrections, voids |
| `PIECE` | PIECE receiving: item lines, per-group barcode, corrections, voids |
| `LABEL` | label data, print/reprint, barcode generation |
| `RECON` | documentary reconciliation/confirmation, both modes |
| `DISC` | discrepancy creation, register, balance |
| `SETTLE` | settlement ledger |
| `COST` | acquisition, transport/customs, allocation, application ledger |
| `VAL` | stock valuation and financial redaction |
| `MODE` | WEIGHT/PIECE selection, inference, branching, mixed-unit vs multi-batch |

Rules:

1. **Never renumber or reuse an ID.** If a capability is removed, keep its row in
   the *after* inventory with status `REMOVED` and the reason.
2. If a behaviour changes materially, keep the ID and mark it `CHANGED`.
3. If one behaviour splits into two, keep the original ID for the closest
   successor and add a new ID for the other half; cross-reference both.
4. If two behaviours merge, keep the more general ID and mark the other
   `MERGED INTO <ID>`.
5. An ID may link to another ID (`↔`) when one user action crosses layers.
6. Never mint an ID for a pure file move or rename.

Comparison statuses after the redesign: `UNCHANGED`, `CHANGED`, `REMOVED`,
`ADDED`, `MERGED`, `SPLIT`, `UNRESOLVED`.

## 5. Inventory columns

Each row records:

| Column | Content |
|---|---|
| **ID and purpose** | stable ID, what the operator or system accomplishes, `↔` links |
| **Entry and consumer** | role, visible control, route/URL, API caller, downstream consumer |
| **Implementation** | exact paths and component/function/endpoint/contract names |
| **Data and effects** | tables/fields read or written, status changes, affected calculations |
| **Conditions** | receipt-level vs batch-level, kg vs vnt., homogeneous vs mixed, pending vs confirmed |
| **Evidence** | browser/HTTP observation, source reference (`path:line`), test name, or an explicitly unresolved question |

One row = one meaningful behaviour or distinct calculation. Do not merge a
calculation with the screen that displays it; they change independently.

## 6. Roles and scenarios to walk

### 6.1 Roles

| Role | Receiving relevance |
|---|---|
| `WAREHOUSE_WORKER` | physical receiving: create receipt, batches, packages/items, correct/void, labels |
| `ADMIN` | everything the worker does **plus** documentary confirmation, discrepancies, settlements, expenses, stock valuation |
| `ACCOUNTING` | no receiving controls; can open `/receipts` (list has no role gate) but not the operational/manager routes |
| `PRODUCTION_MANAGER` | same as `ACCOUNTING` for receiving |

### 6.2 UI walk (from the screen inward)

For **every** receiving screen record: the entry link/button, destination route,
available actions, where Back/list leads, and the empty/loading/error state.

Walk each role through:

1. Home (`/`) → `Naujas priėmimas`.
2. Receipt list (`/receipts`): default queue, each filter, reset, pagination,
   each row action.
3. New receipt (`/receiving/new`): open, leave without saving, validation error,
   submit.
4. Operational receipt (`/receiving/[deliveryId]`): zero batches, one pending
   batch, partially confirmed receipt, fully confirmed receipt.
5. WEIGHT batch (`/receiving/[deliveryId]/batches/[batchId]`): first package,
   repeated packages, correction, void, reprint, Save vs Save-and-print, direct
   URL to a confirmed batch.
6. PIECE batch: first item, multiple products, quick-create product, correction,
   void, per-group label, direct URL to a confirmed batch.
7. Manager receipt (`/receipts/[deliveryId]`, ADMIN): each batch collapsed and
   expanded, itemised and total PIECE documents, mismatch dialog, expense preview
   and apply, re-apply, partially confirmed receipt.
8. **Direct-URL-only** batch detail (`/receipts/batches/[id]`, ADMIN): confirm,
   read confirmed, label preview.
9. Discrepancy register (`/reports/discrepancies`) and detail: filters, settlement
   form, PIECE restriction, fully settled state.

Also record the exact behaviour of the bare `/receiving` URL separately from
`/receiving/new`, the receipt editor and the batch editor, and trace every
`Priėmimų sąrašas` action to its real destination.

### 6.3 Code walk (from the source outward)

Enumerate directly from the tree, not from the UI:

```powershell
Get-ChildItem -Recurse -File apps/web/src/app/receipts,apps/web/src/app/receiving,apps/web/src/app/reports/discrepancies
Get-ChildItem -Recurse -File apps/api/src/modules/batches
Select-String -Path apps/api/src/modules/*/*.controller.ts -Pattern '@(Get|Post|Put|Patch|Delete)\('
Select-String -Path apps/web/src/**/*.tsx -Pattern 'apiFetch<'
```

For each web route/API endpoint record its current consumer, or the finding
**"no identified caller"** with what was searched. No caller is a finding, never
proof that removal is safe.

## 7. Calculation checklist

Every calculation gets its own row with **where calculated, where persisted,
where displayed**:

- net weight (`gross − tare`), tare snapshot;
- active bag count / total net weight;
- active item-line count / total pieces (and aggregation per resource);
- batch status and receipt status derivation;
- weight difference, piece difference, signed formatting;
- required-field rules (documentary weight, acquisition, piece count);
- expense eligibility, allocation basis, per-batch shares, cent rounding,
  allocated/unallocated totals;
- stock quantity and stock value, valuation-incomplete flag;
- discrepancy balance (`original`, `settled`, `remaining`) and direction;
- code and barcode generators (`GYYMM-NN`, `P01..P99`, EAN-13).

For each, state whether another layer computes the same value independently
(parallel calculation) and whether the persisted copy can drift.

## 8. Findings taxonomy

Classify each finding:

| Class | Meaning |
|---|---|
| `DUPLICATE_JOURNEY` | two UI paths reach the same effect |
| `PARALLEL_CALC` | the same value is computed in more than one layer |
| `LEGACY_PATH` | kept for compatibility; current purpose unclear |
| `NO_CALLER` | no web/API consumer found in the searched scope |
| `DOC_DRIFT` | docs/contracts describe behaviour the code does not have |
| `DATA_DEPENDENCY` | needed to read historical receipts or explain applied expenses |
| `UNRESOLVED` | evidence insufficient; question recorded, not answered |

Each finding lists: what was searched, the evidence, the impact, and what remains
uncertain. Never conclude "safe to delete".

## 9. Evidence standards

Allowed evidence, strongest first:

1. **Executed test** — file + exact test name from
   `apps/api/test/*.e2e.test.ts` or a unit test.
2. **HTTP observation** — method, URL, status, date. Read-only GETs only; never
   write live data.
3. **Source reference** — `path:line` and symbol name.
4. **Browser observation** — route, role, visible control and outcome. Record the
   environment (dev server URL) and whether data was real or fixture.
5. **Documentation** — only as a claim to verify, never as proof of behaviour.

If the browser walk or an end-to-end confirmation is not performed, say so in the
baseline and mark affected rows `UNRESOLVED (not exercised live)`.

## 10. Safety rules

- Documentation only: no application-code, schema or migration change.
- No live receiving record is created, edited, confirmed or deleted for the
  inventory.
- Any write needed to prove behaviour uses the dedicated test database
  (`TEST_DATABASE_URL`) and isolated fixtures; never the development database.
- Do not read production data or connect to production infrastructure.
- Leave changes uncommitted for human review.

## 11. Verification

Run the canonical check and record the exact result and the failing stage, if any:

```powershell
npm run verify
```

`verify` = lint → `db:validate` → typecheck → test (all workspaces) → build.
A failure is recorded verbatim; it is not a reason to skip the inventory.

## 12. Producing the comparison

After the redesign, at its own clean baseline:

1. Repeat §3 (new branch/HEAD/status + new fingerprint) and keep the **original**
   baseline document unchanged.
2. Walk §6 again with the same roles and scenarios (add any new ones explicitly).
3. Write `receiving-inventory-after.md` with the **same ID scheme and columns**.
4. Compare by ID only, never by file path:
   - `UNCHANGED` — behaviour, data effects and conditions identical;
   - `CHANGED` — same capability, different implementation/data/conditions
     (record which);
   - `REMOVED` — capability gone (record who depended on it);
   - `ADDED` — new capability;
   - `MERGED`/`SPLIT` — with the cross-references from §4;
   - `UNRESOLVED` — cannot be decided from evidence.
5. For every `REMOVED`/`CHANGED` row, check the `DATA_DEPENDENCY` findings: can old
   receipts still be read and old applied expenses still be explained?
6. Publish the delta as a short table (`ID | before | after | status | action`),
   not as a re-description of both inventories.
