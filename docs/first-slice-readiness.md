# First-Slice Readiness — Blocker Assessment

> **Status: candidates only — NOT an approved roadmap.** See `scope.md`. No slice
> is selected or approved; all remain unconfirmed.

> Decision-preparation document (O-035). Re-evaluates the candidate first
> vertical slices against the ownership, instance-scope, authentication,
> connectivity and requirement uncertainties identified in discovery.
> **This document does not select a winner.**
>
> Blocker vocabulary: `unblocked` · `blocked by ownership decision` ·
> `blocked by instance scope` · `blocked by authentication` ·
> `blocked by legacy connectivity` · `blocked by unclear business requirement`.
> A candidate may have several blockers.

## Candidate comparison

| Candidate | Primary value | Legacy dependency | Write risk | Complexity | Blockers |
|---|---|---|---|---|---|
| 1. Stock lookup ("where is this lot?") | daily operational lookup | read-only, one instance | none | low | instance scope + legacy connectivity + (unclear value vs legacy) |
| 2. Aitvaras-owned stock reception | start capturing new data in Aitvaras | reference data only | low **if** Aitvaras-only; high if it must also appear in Sandėlys | medium | ownership decision + instance scope + authentication + reference data |
| 3. Barcode label viewer/reprint | reduce printing friction | read-only, one instance | none | low–medium | barcode semantics + instance scope + legacy connectivity + unclear requirement |
| 4. Reference-dictionary mirror (enabler) | enables 1–3 | read-only, one instance | none | low | ownership/sync decision + instance scope + legacy connectivity |

## 1. Stock lookup — "where is this lot?"

- **Business value:** answer "where is barcode X / what is it?" quickly.
- **Required data:** one stock (or lineage) by barcode with current place,
  status, type, quantity.
- **Legacy dependency:** read-only against a single instance.
- **Write risk:** none.
- **Complexity:** low (adapter read + identity mapping + a screen).
- **Blockers:**
  - `blocked by instance scope` — which database? (Business decision G2.)
  - `blocked by legacy connectivity` — read-only credentials + network path to
    the legacy MySQL (currently bound to `127.0.0.1`).
  - `blocked by unclear business requirement` — while Sandėlys stays available,
    a read-only duplicate may add little; the owner must confirm the value.
- **Would be unblocked by:** G1–G3 answered, a decided read-only access path,
  and confirmation that lookup in Aitvaras is worth building before Aitvaras
  owns any data.

## 2. Aitvaras-owned stock reception (register new stock)

- **Business value:** new stock begins to live in Aitvaras; first real write.
- **Required data:** locations/places, types/categories, suppliers (reference),
  identity/audit.
- **Legacy dependency:** reference data (mirrored or read), plus attribution if
  the same person works in both systems.
- **Write risk:** **low** if new stock is Aitvaras-only; **high** if Aitvaras
  stock is also expected to be visible/editable in Sandėlys (that would require
  a write or sync design — currently prohibited by ADR-005).
- **Complexity:** medium (ownership decision, auth, reference data, UI).
- **Blockers:**
  - `blocked by ownership decision` — do new lots belong to Aitvaras at launch?
  - `blocked by instance scope` — which company/site first?
  - `blocked by authentication` — who logs in to Aitvaras, and how?
  - reference-data dependency (mirror or read).
- **Would be unblocked by:** B1 answered ("Aitvaras registers new stock"), G1–G4
  answered, an auth decision (E1), and reference data available.

## 3. Barcode label viewer/reprint

- **Business value:** reduce printing friction (aligns with pain point P-004).
- **Required data:** one stock + rendered label.
- **Legacy dependency:** read-only, one instance.
- **Write risk:** none.
- **Complexity:** low–medium (label rendering).
- **Blockers:**
  - `blocked by unclear business requirement` — the legacy print-UX fix (O-030)
    may address this pain without Aitvaras.
  - `blocked by instance scope` and `blocked by legacy connectivity`.
  - **barcode semantics decision** (B6/B7) — whether a barcode is identity,
    lineage or just printable, and whether old barcodes must keep resolving.
- **Would be unblocked by:** deciding whether this belongs in legacy first,
  B6/B7 answered, and the same access path as candidate 1.

## 4. Reference-dictionary mirror (enabler)

- **Business value:** **none directly** — it is an enabler for candidates 1–3.
- **Required data:** countries, categories, types, containers (and later places,
  suppliers, buyers).
- **Legacy dependency:** read-only, one instance.
- **Write risk:** none (Aitvaras stores a non-authoritative copy).
- **Complexity:** low.
- **Blockers:**
  - `blocked by ownership decision` — must acknowledge Sandėlys as
    source-of-truth and the mirror as non-authoritative (ADR-005).
  - `blocked by instance scope` + `blocked by legacy connectivity`.
- **Note:** this is the most technically unblocked step, but it is
  infrastructure, not a user-facing slice, so it should not be treated as the
  product's first feature.

## Cross-cutting blockers (affect every candidate)

| Blocker | What resolves it |
|---|---|
| Instance scope | Business decisions G1–G3; ADR-006 |
| Legacy connectivity | Decided read-only access path and credentials (O-021/O-035 follow-on) |
| Authentication | Business decision E1; an explicit Aitvaras auth slice |
| Ownership/write rules | `data-ownership.md` answers and ADR-005 constraints |

## Assessment summary (no winner selected)

- **No candidate is fully `unblocked` today.** The common blockers are instance
  scope and legacy connectivity; candidate 2 additionally needs an ownership
  decision and authentication.
- **Candidate 1 (stock lookup)** has the fewest decision dependencies, but its
  value while Sandėlys remains available must be confirmed.
- **Candidate 4 (dictionary mirror)** is the least technically blocked but
  delivers no direct business value.
- The owner should answer `business-decisions.md` G1–G3 and B1 first; those
  answers have the largest effect on which slice becomes viable.

## Related documents

- `data-ownership.md`, `transition-model.md`, `business-decisions.md`
- `integration-boundaries.md`, `identity-strategy.md`
- `/aitvaras/TODO.md`
- ADR-003 (proposed), ADR-005 (accepted), ADR-006 (proposed)
