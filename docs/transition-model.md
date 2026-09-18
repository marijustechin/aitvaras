# Transition Model — Ownership, Write Authority and Synchronisation

> **Status: proposed rules only — NOT an approved roadmap.** See `scope.md`. No
> transition or integration is approved.

> Decision-preparation document (O-035). Defines the controlled vocabulary for
> how a concept moves from Sandėlys to Aitvaras, and the strict rules that
> constrain any such move. Architectural rules here are recorded as accepted in
> ADR-005; the per-concept choices remain business decisions
> (`data-ownership.md`, `business-decisions.md`).

## 1. Transition modes (controlled vocabulary)

Use exactly these terms when describing a concept's transition.

### Legacy-only
Sandėlys remains authoritative. Aitvaras may read through the adapter but does
not own or modify the concept.
*Use when Aitvaras has no need to own the concept yet.*

### Read-through
Sandėlys remains authoritative. Aitvaras presents or uses a **normalised read
model** at the integration boundary; nothing is stored authoritatively in
Aitvaras.
*Use for mutable operational data needed only for display/decisions.*

### Mirrored reference data
Sandėlys is source-of-truth **temporarily**; Aitvaras stores a local copy for
efficient use. The copy is explicitly **non-authoritative**.
*Only for relatively stable reference data (dictionaries, layout, partners).*

### Aitvaras-owned
New records are created and modified only in Aitvaras. Legacy integration may
exist only for historical/reference purposes.
*Use for new concepts and for concepts whose ownership has moved.*

### Migration
Ownership moves from Sandėlys to Aitvaras according to an **explicit migration
plan** (scope, cutover, reconciliation, rollback).
*Use only with a recorded, per-domain plan.*

### Retired
The legacy concept is **not carried forward** because it is no longer a valid
business requirement.
*Requires confirmation that the concept is genuinely unused.*

> Not every legacy concept needs a transition. Some are retired; some Aitvaras
> never needs to know about.

## 2. Write-authority rules (strict)

1. **Single writer.** A business concept has exactly **one authoritative
   writer** at any time, unless a separately approved synchronisation design
   exists (an ADR). No concept may be edited in two systems simultaneously.
2. **No direct writes by default.** Aitvaras must **not** write directly to
   Sandėlys by default. Any write authority is a per-concept, explicitly
   approved exception.
3. **No two-way sync by default.** Two-way synchronisation is **prohibited**
   unless explicitly approved by an ADR.
4. **Adapter is read-only.** Legacy database writes from Aitvaras are not
   allowed through the read adapter. The adapter exposes reads and, if ever
   needed, explicitly-scoped commands — never raw writes.
5. **Mirrors are non-authoritative.** Mirrored data in Aitvaras must be clearly
   marked (in schema and code) as a non-authoritative copy, with provenance and
   a refresh/reconciliation path.
6. **No legacy ids as identity.** Aitvaras-owned entities must not use legacy
   numeric ids as their identity (`identity-strategy.md`).
7. **Explicit per-domain migration.** Migration is per-domain and staged; there
   is no all-at-once migration assumption.

## 3. Ownership invariants

- **Physical reality has one system of record.** A physical lot, order or
  dispatch is authoritative in exactly one system.
- **History is not retro-fitted into authority.** Importing legacy history does
  not make Aitvaras the author of that history; imported records carry
  provenance and are marked as such.
- **A concept may be read by both systems, written by one.**
- **Ownership transitions are reversible-by-plan, not by accident.** Each
  migration defines a rollback.

## 4. Synchronisation rules (when a mirror exists)

- Direction is **one-way legacy → Aitvaras** unless an ADR approves otherwise.
- A mirror records `sourceInstance`, `sourceId`, `observedAt` and a content
  hash/version where practical.
- Deletions and updates must be detected by **periodic reconciliation**, because
  legacy `updated_at` is not a reliable change stream and legacy hard-deletes.
- A mirror must not be edited in Aitvaras; corrections happen at the source or
  by re-sync.
- If the source becomes unavailable, Aitvaras must degrade predictably — it must
  not silently serve stale mirrors as authoritative.

## 5. Suggested transition sequence (guidance, not a commitment)

```text
1. Aitvaras-owned foundation (identities, audit, tenant)
2. Mirrored reference data (dictionaries, layout, partners)      [low risk]
3. Read-through operational views (stock lookup, order visibility)
4. Aitvaras-owned new records for one concept (e.g. new stock lots)
5. Per-domain migration + cutover (owner moves), with reconciliation
6. Sandėlys becomes read-only for migrated concepts
7. Retire legacy concepts that are no longer required
```

Each numbered step requires its own decision where it touches ownership.

## 6. Non-goals

- Designing the integration protocol (ADR-003 only recommends its shape).
- Implementing adapters, mirrors, sync or migrations (none is built).
- Deciding per-concept ownership (that is the business decision).

## 7. Related documents

- `data-ownership.md` — ownership decision matrix
- `business-decisions.md` — the questionnaire
- `first-slice-readiness.md` — blockers per candidate slice
- `integration-boundaries.md`, `identity-strategy.md`,
  `legacy-as-reference.md`
- ADR-003 (proposed), ADR-005 (accepted; these rules), ADR-006 (proposed)
