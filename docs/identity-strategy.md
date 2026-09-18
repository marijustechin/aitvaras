# Identity Strategy — Referencing Sandėlys Entities from Aitvaras

> Design proposal, not implemented. Compiled 2026-09-18. The goal is to
> reference legacy entities **safely** without adopting legacy identifiers as
> Aitvaras identities, and without assuming identifiers are unique across
> instances.

## 1. The problem (observed)

- Legacy uses **per-database auto-increment integer ids** for every entity.
- Production runs **seven independent instances/databases** on one host
  (`main`, `af`, `gb`, `dev`, `lt`, `ltn`, `pl`), each with its own `stocks`,
  `orders`, `users`, etc. The same id means different things in different
  databases.
- **Barcodes are not unique** — not globally, not per instance, and not even
  conceptually per stock:
  - duplicate values are allowed and expected (no DB unique constraint);
  - partial transfers and manufacturing outputs create **child** rows sharing
    the parent's barcode (`parent_id` lineage);
  - `StockController::makeBarcode` embeds the creation date and the local id,
    so two instances can generate the same barcode on the same day.
- Users are per-instance with `login` as the only unique credential.
- Country ids come from a shared seed (ISO-like numeric codes) and are the one
  dictionary plausibly consistent across instances.

**Conclusion:** neither legacy ids nor barcodes can serve as Aitvaras
identifiers or as a global join key.

## 2. Principles

1. **Aitvaras owns its identities.** Every Aitvaras entity gets an Aitvaras
   identifier (UUID or ULID) independent of legacy ids.
2. **Legacy ids are external references only**, stored in a mapping, never as
   the Aitvaras primary key and never exposed as an Aitvaras public id.
3. **Instance is part of identity.** A legacy reference is meaningless without
   the instance it came from.
4. **No cross-instance joins.** Data from different instances must never be
   assumed to share ids.
5. **Barcodes are attributes, not identity.** They may be used for lookup, but
   must be resolved to a specific stock (or lineage) with explicit rules.
6. **Provenance travels with data.** Any imported/mirrored row records where it
   came from and when it was observed.

## 3. Proposed external-reference model (conceptual)

A mapping record (owned by Aitvaras) links an Aitvaras entity to a legacy
entity:

```text
ExternalReference
  id                     Aitvaras PK (UUID/ULID)
  sourceSystem           "sandelys"
  sourceInstance         "gb" | "ltn" | "af" | ...   (required)
  legacyEntityType       "stock" | "order" | "sale" | "user" | ...
  legacyId               integer (per-instance)
  legacyNaturalKey       optional (e.g. barcode, login) - NOT unique
  aitvarasEntityType     e.g. "inventory-lot"
  aitvarasEntityId       Aitvaras PK
  observedAt             timestamp
  metadata               optional JSON
  UNIQUE (sourceSystem, sourceInstance, legacyEntityType, legacyId)
```

Rules:

- The unique key is the **composite** `(sourceSystem, sourceInstance,
  legacyEntityType, legacyId)`. Nothing weaker.
- `legacyNaturalKey` (barcode/login) is stored only for lookup/debugging and is
  never assumed unique.
- The mapping is one-directional (legacy → Aitvaras) initially. If Aitvaras
  ever writes back, a reverse mapping is added deliberately per concept.
- Aitvaras domain code depends on its own ids; only the adapter layer knows or
  uses the mapping.

## 4. Per-entity notes

| Entity | Stable per instance? | Aitvaras treatment | Caveat |
|---|---|---|---|
| **Stock lot** | `id` is stable; row mutates | Own Aitvaras lot id; map legacy `stocks.id`; model lineage explicitly | Barcode is a lineage attribute; duplicates common |
| **Barcode** | Generated, mutable-once | Store as attribute; index for lookup; keep parent/child relation | Not unique; not identity |
| **Stock log / movement** | Rows can be deleted | Build Aitvaras append-only history; optionally import legacy rows read-only | Legacy history is deletable |
| **Place / location** | Per-instance dictionary | Map by `(instance, place.id)`; keep names | Place `40` hardcoded in code |
| **Stock type / category / container** | Per-instance dictionary (same seed) | Map by `(instance, id)`; consider code/name matching across instances | Seed may drift per instance |
| **Supplier / buyer** | Per-instance | Map by `(instance, id)`; `supplier.id=1` special default | `deleted_at` column exists but is inert |
| **Country** | Shared seed | Map by `(instance, id)`; `code` is a better natural key | Likely consistent |
| **User** | Per-instance, `login` unique per instance | Aitvaras owns identities; map legacy users only for attribution | Never migrate passwords |
| **Order** | Per-instance; no order number | Map by `(instance, order.id)`; `name` is free text | No structured order key |
| **Sale** | Per-instance | Map by `(instance, sale.id)` | — |

## 5. Lookup / de-duplication rules (for adapter-level use)

When legacy barcode lookup returns multiple rows:

1. Filter to the relevant instance.
2. Prefer the row matching the expected status for the operation (legacy itself
   does this in places, e.g. “is any of these in the warehouse?”).
3. If still ambiguous, return all candidates to the caller as a **lineage**
   (parent + children) rather than guessing. Aitvaras must not silently pick
   `->first()` the way the legacy home lookup does.
4. Record the resolution decision for auditability.

## 6. Multi-instance configuration

- Aitvaras must name an instance explicitly in every legacy operation
  (`sourceInstance`), never “the legacy DB”.
- Connection/config is instance-scoped (`sandelys_<instance>`), and the adapter
  is constructed per instance. Credentials come from configuration/environment,
  never code.
- Aitvaras should not assume it is connected to every instance at once. Start
  with **one** confirmed instance (business decision O-021); additional
  instances are added deliberately.

## 7. What is intentionally not done yet

- No mapping table is created in this task (`packages/database` schema stays
  empty).
- No adapter, connection or sync is implemented.
- A tiny proof of the mapping shape is **not** required yet; the design is
  simple enough to validate when the first slice is built.

## 8. Open questions (business / technical)

- Which instance is in scope first? (O-021)
- Are tenant instances to be unified in Aitvaras, or modelled as separate
  tenants?
- Is legacy history to be migrated or only referenced?
- Who assigns Aitvaras ids, and are they UUIDv7/ULID (sortable) — an
  implementation choice to record when the schema is defined.
