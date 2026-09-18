# ATV-002 — Aitvaras ↔ Sandėlys integration and ownership boundaries (O-033)

**Status:** done
**Date:** 2026-09-18
**Target repositories:** `/aitvaras` (docs); workspace ADR; `/sandelys` read-only

## Objective

Replace assumptions about the relationship between `/sandelys` and `/aitvaras`
with a verified integration and ownership model, and produce an ADR/recommendation
**without implementing any integration**.

## Scope

**In:** legacy domain/persistence discovery; workflow tracing; ownership matrix;
identity strategy; multi-instance findings; integration options assessment;
candidate modules; candidate first vertical slices; ADR-003 (proposed).

**Out:** any legacy code change; any DB access; any Aitvaras business tables,
adapter, mapping or sync; any invented API; commits.

## Work performed

- Read the legacy schema (38 migrations), 20 models, all key controllers
  (`Home`, `Stock`, `Transfer`, `Order`, `Sale`, `StockError`,
  `Admin\ReportController`), policies, middleware, seeders, `config/menu.php`,
  `config/app.php`, `config/audit.php`, and the destructive `DeleteData`
  console command.
- Confirmed identifier reality: per-instance auto-increment ids, non-unique
  11-char barcodes used as lineage keys, seeded numeric ids, hardcoded place 40.
- Confirmed history model: `stock_logs` (explicit but deletable on correction)
  plus `audits` (generic); no model except `User` actually uses `SoftDeletes`.
- Confirmed multi-instance reality from `docs/discovery/infrastructure.md` /
  `production-code-baseline.md`: seven instances, no canonical one confirmed.
- Assessed options A–D and recorded a recommended adapter-first hybrid.

## Decisions

- **No integration is implemented.** Aitvaras owns its data model; legacy data
  is accessed only through an eventual read-only, instance-scoped adapter.
- Legacy ids/barcodes are **external references only**; Aitvaras uses its own
  identifiers (`identity-strategy.md`).
- Small reference dictionaries are candidates for **one-way legacy → Aitvaras**
  mirroring; transactional concepts need a business ownership decision.
- ADR-003 is recorded as **proposed**, not accepted.

## Files changed

New in `/aitvaras/docs/`:

- `legacy-domain-map.md`
- `legacy-workflows.md`
- `data-ownership.md`
- `identity-strategy.md`

Updated in `/aitvaras/docs/`:

- `integration-boundaries.md` (evidence, options assessment, recommendation)
- `architecture.md` (candidate modules section)
- `TODO.md` (CURRENT/NEXT, candidate slices)

Workspace root (not a Git repo):

- New `docs/decisions/ADR-003-aitvaras-sandelys-integration-direction.md`
- Updated `docs/decisions/README.md`, `docs/system/project-state.md`,
  `docs/discovery/legacy-system.md` (soft-delete correction), `TODO.md`,
  `ops/backlog.md` (O-033 done, O-035 added), `ops/current.md`
- New `ops/done/2026-09-18-aitvaras-integration-discovery.md`
- New `/aitvaras/tasks/done/ATV-002-integration-and-ownership-boundaries.md`

## Verification

- Documentation-only change; no code paths altered. `/sandelys` working tree
  clean (`git status --short` empty).
- `/aitvaras` `pnpm verify` unchanged and still passing from ATV-001 (no source
  change in this task); artifact tree unchanged.
- `git diff --check` clean in `/aitvaras`.

## Unresolved issues

- Business decisions: canonical instance (O-021), per-concept ownership, write
  authority, latency, migration scope (O-035).
- Whether `stock_errors` and messenger are live features.
- How Aitvaras reaches legacy MySQL and who owns read-only credentials.
- Whether Aitvaras serves one tenant first.

## Recommended next task

**O-035 — business decisions on ownership/write authority**, then **O-034 —
first Aitvaras vertical slice** (recommended candidate: stock lookup).

## Addendum — Sandėlys is a reference, not a blueprint (ADR-004)

Added 2026-09-18 after the discovery above (the user requested this principle be
appended to this task and treated as a project-wide rule).

- New canonical rule doc: `/aitvaras/docs/legacy-as-reference.md`.
- Accepted workspace ADR: `docs/decisions/ADR-004-sandelys-is-a-reference-not-a-blueprint.md`.
- Agent-facing rule added to `/aitvaras/AGENTS.md` and workspace `AGENTS.md`.
- Summarised in `/aitvaras/docs/architecture.md` and linked from
  `integration-boundaries.md` and `README.md`.
- Effect: legacy discovery documents must separate **Observed in Sandėlys /
  Business requirement / Aitvaras decision / Rationale**, and no Aitvaras design
  may be justified solely with "Sandėlys does it this way".
