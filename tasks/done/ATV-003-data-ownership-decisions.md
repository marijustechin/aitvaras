# ATV-003 — Data ownership and write-authority decision preparation (O-035)

**Status:** done
**Date:** 2026-09-18
**Target repositories:** `/aitvaras` (docs); workspace ADRs

## Objective

Turn existing discovery into a clear decision framework for which system owns
which business concepts and where write authority lives during the Sandėlys →
Aitvaras transition. Prepare facts, options and consequences; the human owner
makes the decisions. **No implementation.**

## Scope

**In:** ownership decision matrix; transition-mode vocabulary; write-authority
rules; business questionnaire; instance-scope decision section; first-slice
readiness re-evaluation; ADRs.

**Out:** business tables/models/endpoints; adapters/sync/migration code;
inventing business answers; changing `/sandelys`; commits.

## Implemented work

- Consolidated prior evidence (legacy-domain-map, legacy-workflows,
  identity-strategy, integration-boundaries, architecture, ADR-003/004) without
  reopening legacy discovery.
- Rebuilt `docs/data-ownership.md` around a **14-concept decision matrix** with
  explicit statuses (`confirmed`/`proposed`/`business decision required`/
  `not needed`/`deferred`) and per-concept read/write/migration/sync/split-risk/
  question detail.
- Added `docs/transition-model.md`: controlled transition vocabulary
  (legacy-only, read-through, mirrored reference data, aitvaras-owned,
  migration, retired) and the seven strict write-authority rules; recorded as
  **ADR-005 (accepted)**.
- Added `docs/business-decisions.md`: business-language questionnaire
  (sections A–H) plus the instance-scope decision section (G) — no answers
  invented.
- Added `docs/first-slice-readiness.md`: candidate slices assessed against
  ownership/instance-scope/auth/connectivity/requirement blockers, plus an
  enabler candidate. No winner selected.
- Recorded **ADR-006 (proposed)** for instance scope / tenancy, which requires
  business confirmation.

## Decisions

- ADR-005 (accepted): single writer per concept; no Aitvaras→Sandėlys writes by
  default; no two-way sync without an ADR; read adapter is read-only; mirrors are
  non-authoritative; no legacy ids as identity; per-domain staged migration.
- ADR-006 (proposed): start single-scope with an explicit Aitvaras tenant
  concept; preserve `sourceInstance`; do not build for inactive instances.
- No per-concept ownership was decided; all such rows remain
  `business decision required`.

## Files changed

New in `/aitvaras/docs/`: `transition-model.md`, `business-decisions.md`,
`first-slice-readiness.md`.
Rewritten/extended: `data-ownership.md`.
Updated: `TODO.md`.
New: `/aitvaras/tasks/done/ATV-003-data-ownership-decisions.md` (this file).

Workspace root (not a Git repo): new
`docs/decisions/ADR-005-transition-ownership-and-write-authority.md`,
`docs/decisions/ADR-006-aitvaras-instance-scope.md`,
`ops/done/2026-09-18-aitvaras-ownership-decisions.md`; updated
`docs/decisions/README.md`, `docs/system/project-state.md`, `ops/backlog.md`,
`ops/current.md`.

**No `/sandelys` file changed. No code changed.**

## Verification

- Documentation-only; no app source change. `pnpm verify` unaffected.
- `/aitvaras` `git diff --check` clean; `/sandelys` `git status --short` empty.
- Cross-references resolve; statuses and blocker vocabulary used consistently.
- No secret recorded; no business answer fabricated; no commit or push.

## Unresolved issues

- All per-concept ownership and write-authority questions are open until the
  business answers `business-decisions.md` (O-036).
- Instance scope (ADR-006) is proposed only.
- Legacy connectivity (network/credentials) and authentication remain undecided.

## Recommended next task

**O-036 — business decision session on ownership/write authority** (answer
`business-decisions.md`, prioritising G1–G3 and B1), which unblocks slice
selection and **O-034**.
