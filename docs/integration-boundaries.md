# Integration Boundaries — Aitvaras ↔ Sandėlys

> **Status: boundary principle only — NOT an approved roadmap.** See `scope.md`.
> No integration is designed, approved or built.

> Status: **boundary principle defined; integration protocol NOT implemented.**
> Discovery for a recommended direction was completed 2026-09-18 (this file,
> plus `legacy-domain-map.md`, `legacy-workflows.md`, `data-ownership.md`,
> `identity-strategy.md`). The recommended direction is recorded in workspace
> ADR-003. No adapter, connection, sync or mapping exists yet.

## Principle

Aitvaras is a separate application with its own database and its own domain
model. It must communicate with the legacy warehouse through an **explicit
integration boundary**. This is part of the project-wide rule that `/sandelys`
is a [reference, not a blueprint](legacy-as-reference.md) (ADR-004).

> If temporary direct database reading of the legacy system is eventually
> required, knowledge of the legacy schema and queries must remain encapsulated
> behind an adapter and must not leak into Aitvaras core domain logic.

This means:

- No legacy table/column names, ids, SQL or status numbers appear in Aitvaras
  domain code, entities or contracts.
- Any legacy access is exposed to the domain as a narrow, typed interface in
  **Aitvaras vocabulary**.
- The adapter is the only place allowed to know how `/sandelys` is shaped or
  reached, and it is replaceable.

## Conceptual shape

```text
Aitvaras application
      ↓  (depends on)
SandelysIntegrationPort            Aitvaras-owned interface, Aitvaras types
      ↑  (implemented by)
LegacyMySqlSandelysAdapter         ONLY place that knows legacy schema/instance
      ↓
legacy MySQL (one instance, e.g. sandelys_gb)
```

The `integrations/sandelys` package **does not exist yet**. It is created only
when the first slice needs legacy data.

## What discovery established (2026-09-18)

Observed facts (full detail in `legacy-domain-map.md` / `legacy-workflows.md`):

1. `/sandelys` is a Laravel 5.4 monolith with **no usable API**
   (`routes/api.php` is the Laravel default).
2. It is tightly coupled to its MySQL schema; business rules live in fat
   controllers with no service layer and no meaningful tests.
3. There are **seven independent instances/databases** on one host; a canonical
   instance is not confirmed.
4. All identifiers are **per-instance auto-increment integers**; barcodes are
   **not unique** (lineage keys). See `identity-strategy.md`.
5. History is **mutable/deletable** (`stock_logs` rows are removed on
   corrections); `audits` is a secondary generic change log.
6. Business semantics depend on **seeded numeric ids** and one hardcoded place
   id (40).
7. Legacy runs on an **EOL platform** (Ubuntu 16.04, PHP 7.0, MySQL 5.7) with
   no TLS and no automated backups.
8. Aitvaras currently needs **nothing** from Sandėlys to run.

## Options assessment

### Option A — Add a narrow API to `/sandelys`

- Implementation effort: **high** for the value — the codebase has no service
  layer, fat controllers mix validation/persistence/reporting, and there is no
  test safety net.
- Maintenance burden: high; it would be built on an EOL framework and PHP
  runtime that receives no security updates.
- Security: negative — it would expose a new network surface from a host with
  no TLS and multiple tenant DBs.
- Transactional correctness: could be made correct, but only by adding a real
  service layer first — a large legacy change.
- Stability of business semantics: poor initially, because current semantics
  are implicit in controllers.
- **Assessment: not justified now.** Revisit only if the business wants to
  invest in the legacy app and a canonical instance/API contract is agreed.

### Option B — Read-only legacy DB adapter (per instance)

- Schema coupling: confined to one adapter, acceptable **if** the adapter
  exposes Aitvaras read models and never leaks legacy names.
- Operational simplicity: high — no change to the legacy system; a read-only DB
  account per instance.
- Consistency: no snapshot/transaction guarantees across the boundary; reads
  reflect live mutable state (and legacy corrections delete history).
- Security: a read-only DB credential is a real secret to manage; the legacy DB
  currently listens only on `127.0.0.1`, so Aitvaras would need network access
  (tunnel/allow-list) — an infrastructure decision.
- Multiple instances: must be explicitly instance-scoped; no cross-instance
  joins.
- Failure modes: legacy DB unavailability becomes an Aitvaras read-path
  dependency unless cached/mirrored.
- **Assessment: viable and lowest-risk for a first read-only slice**, behind a
  strict anti-corruption layer and with explicit per-instance configuration.

### Option C — Replication / synchronisation into Aitvaras PostgreSQL

- Direction: initially **one-way legacy → Aitvaras**.
- Source of truth: legacy remains authoritative for synchronised concepts; this
  must be explicit to avoid two-writer conflicts.
- Latency: batch/near-real-time is sufficient for the workflows seen; hard
  real-time is not evidenced.
- Conflict handling: avoided by one-way sync; two-way sync is **not**
  recommended in the near term.
- Incremental identifiers: `updated_at` exists and is indexed on key tables
  (`stocks`), but legacy updates can be non-monotonic and corrective deletes are
  blind to it. A high-water-mark `updated_at` sync is **approximate** and needs
  reconciliation; there is no reliable per-row version or change-log stream.
- Deletes: legacy hard-deletes (stocks) and deletes log rows, so deletions are
  not observable via `updated_at`. Requires periodic reconciliation.
- Historical data: large and partly disposable; requires explicit scope.
- **Assessment: strong fit for small, stable reference dictionaries**
  (countries, categories, types, containers, places) and for read-heavy
  reporting copies. Weak fit for authoritative operational state unless
  reconciliation is designed.

### Option D — Hybrid transition

- Start read-only (B) and/or mirror dictionaries (C) while Sandėlys stays the
  system of record; progressively move ownership of specific concepts to
  Aitvaras; retire parts of Sandėlys last.
- **Assessment: consistent with ADR-001 and the multi-instance reality**, and
  the only approach that avoids a big-bang change. Requires per-concept
  ownership ADRs.

## Recommended direction (summary — see ADR-003)

An **adapter-first hybrid**: no integration now; when a real slice needs legacy
data, use a **read-only, instance-scoped legacy adapter** exposing Aitvaras read
models, and mirror **small reference dictionaries** into Aitvaras-owned tables
over time. No writes to Sandėlys, no two-way sync, no event bus, and no legacy
API investment unless the business explicitly decides otherwise.

## Explicit non-goals for now

- Designing or implementing an integration protocol.
- Creating an adapter package before a slice needs it.
- Copying any legacy table structure, id scheme or SQL into Aitvaras.
- Granting Aitvaras write authority over legacy data.

## Open questions (must be answered by the business before implementation)

1. **In-scope instance.** Which production instance/database is canonical and
   in scope first? (O-021)
2. **Read need.** Which specific legacy data does the first slice actually
   require?
3. **Write authority.** May Aitvaras ever write to Sandėlys during transition?
   (Default: no.)
4. **Ownership per concept.** See `data-ownership.md`.
5. **Latency.** What freshness is acceptable for mirrored dictionaries and
   operational reads? (Likely batch/near-real-time, to be confirmed.)
6. **Migration scope.** What historical data is migrated vs abandoned?
7. **Network/credentials.** How does Aitvaras reach the legacy MySQL
   (tunnel/allow-list) and who owns the read-only credentials?
8. **Coexistence.** Does Aitvaras run alongside one tenant first, or several?

## Revisit triggers

The recommendation is revisited if: the business requires near-real-time
two-way operation; a canonical instance and a funded legacy API are agreed;
data volumes make polling impractical; or Aitvaras becomes the system of record
for a concept sooner than expected.

## Related documents

- `docs/legacy-domain-map.md`
- `docs/legacy-workflows.md`
- `docs/data-ownership.md`
- `docs/identity-strategy.md`
- `docs/architecture.md`
- Workspace `docs/decisions/ADR-003-aitvaras-sandelys-integration-direction.md`
