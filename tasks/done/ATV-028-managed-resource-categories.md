# ATV-028 — Administrator-managed resource categories

- **Status:** done (uncommitted; for human review)
- **Scope:** resources / master data (confirmed scope)

## Objective

Replace the fixed `ResourceCategoryKey` enum with administrator-managed resource
categories, preserving the three historical values and every existing resource's
effective category.

## Previous representation

`Resource.category` was a PostgreSQL enum (`ResourceCategoryKey`) with three
values (`RAW_MATERIAL`/`SEMI_FINISHED`/`FINISHED_PRODUCT`, labels `Žaliava`/
`Pusgaminis`/`Gaminys`). Adding a category required a code + enum + migration
change; there was no CRUD.

## New data model

- **`ResourceCategory`** (map `resource_categories`): UUID `id`, unique
  `name` (≤ 255), `active` (default true), `createdAt`/`updatedAt`. Deactivated,
  never hard-deleted.
- **`Resource.categoryId`** → FK to `resource_categories` (`ON DELETE RESTRICT`);
  the enum and the old `category` column are removed.

## Migration (`managed_resource_categories`)

Hand-written, data-safe (the Prisma-generated destructive form was not used):
1. create `resource_categories` + unique name index;
2. insert the three historical categories with **deterministic fixed UUIDs**;
3. add nullable `resources.category_id`;
4. backfill every resource from the old enum value;
5. `SET NOT NULL` + FK + index;
6. drop the old column, its index and the enum type.

Works on a fresh DB and on an existing DB. Verified on the existing dev DB: the
two existing resources were both remapped (category retained) and the enum type
is gone.

## API

- New `resource-categories` module: `GET /resource-categories` and
  `GET /resource-categories/:id` (authenticated), `POST` and `PATCH /:id`
  (ADMIN). No `DELETE`. Duplicate name → `409`; unknown → `404`; blank/unknown
  fields → `400`.
- `resources` service loads the category relation and returns
  `categoryId`/`categoryName`/`categoryActive`. Create requires an existing
  **active** category; update rejects newly selecting an **inactive** category
  but keeps a resource's currently assigned inactive category.

## Web

- New `/resources/categories` page (linked from `/resources`): list (name,
  status, edit, activate/deactivate) + create; ADMIN-gated controls.
- Resource create/edit form loads categories from the API (no hard-coded list).
  New resource: active categories only; edit: the currently assigned category
  remains selectable even if inactive, shown as `… (neaktyvi)`.

## Fixed-category dependencies refactored

- `packages/contracts/src/resources.ts` (enum + labels removed; `categoryId`
  added), `resource-categories.ts` (new).
- API `resources.service.ts` / `resource.mapper.ts`.
- Web `entities/resource/resource.ts` (`resourceCategoryLabel` removed),
  `features/manage-resources/**`.
- Tests: `resources.e2e`, `receipts.e2e` seed, contracts `resources.test.ts`.
- No production/manufacturing code branched on the three category names; there
  was no name/key-based business behaviour to preserve.

## Tests

Contracts (`resources`, `resource-categories`), API e2e
(`resource-categories`, updated `resources`, updated `receipts` seed), web
(entity + form lib). `pnpm verify` green.

## Limitations

- Categories are flat (no hierarchy/tree) — not requested.
- `name` uniqueness is case-sensitive (database default), consistent with other
  master data; no case-normalisation subsystem.
- Historical resources keep their category via migration; a migration-level
  preservation test is not part of the suite (verified manually on the dev DB
  and covered by the seeded-category and inactive-category e2e tests).
