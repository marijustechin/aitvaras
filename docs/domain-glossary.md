# Domain Glossary (Aitvaras)

> Status: lightweight, **confirmed terminology only**. This file records
> confirmed business vocabulary so it is used consistently in code, UI and
> documentation. It reflects what is implemented; see [scope.md](scope.md).

Do not add speculative or legacy-derived vocabulary.

## Partneris (partner)

A business counterparty. One unified concept — **not** split into separate
supplier/buyer entities. A partner may be one or both of:

| Role key | Lithuanian |
|---|---|
| `SUPPLIER` | Tiekėjas |
| `BUYER` | Pirkėjas |

Partner roles are independent of system **access roles** (`ADMIN`,
`WAREHOUSE_WORKER`, `ACCOUNTING`, `PRODUCTION_MANAGER`).

**Status: implemented** (`docs/partners.md`).

## Išteklius (resource)

A business item/material/product handled by Aitvaras. Has exactly one category,
a required name, optional notes, and an active/inactive lifecycle.

**Status: implemented** (`docs/resources.md`).

## Išteklių kategorija (resource category)

A fixed domain classification. A resource has exactly one. Adding a category is
a domain/schema decision, not end-user configuration. Confirmed categories:

| Key | Lithuanian |
|---|---|
| `RAW_MATERIAL` | Žaliava |
| `SEMI_FINISHED` | Pusgaminis |
| `FINISHED_PRODUCT` | Gaminys |

**Status: implemented** as a stable enum (`docs/resources.md`).

## Pakavimo forma (packing form)

How goods are physically packed/presented for handling/storage. **Independent
reference/master data** — deliberately **not** a permanent property of a
resource (a later delivery may use a different form). Confirmed initial forms:

```text
Dėžė
Maišas
Metalinis narvas
Rulonas
```

**Status: implemented** as reference data with an explicit idempotent seed
(`pnpm seed:reference`); see `docs/resources.md`. The resource/receipt link is
**not** implemented.

## Not yet implemented

The following are **not** built and must not be treated as implemented: goods
receipt, purchasing, stock balances, warehouse locations, quantities,
production, orders, dispatch, sales, barcode workflows, reporting.

## Language conventions

- User-facing text is **Lithuanian**; code/API/database identifiers are
  **English**.
- User-facing terms follow the terminology rule in `AGENTS.md` (Role → Vaidmuo,
  Roles → Vaidmenys, Status → Būsena, Statuses → Būsenos).

## Related documents

- [scope.md](scope.md) — confirmed scope
- [partners.md](partners.md) — the partner module
- [resources.md](resources.md) — resources, categories and packing forms
- [legacy-as-reference.md](legacy-as-reference.md) — reference, not blueprint
