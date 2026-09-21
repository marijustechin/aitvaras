# ATV-019 — Record backend architecture rules

**Status:** done
**Date:** 2026-09-21
**Target repository:** `/aitvaras`
**Workspace ID:** O-056

## Objective

Documentation/architecture-governance only: record the current Aitvaras backend
structure as the **approved baseline** and define evolution rules. No backend
code refactor, no file moves, no functionality/API/schema/frontend/test changes.

## Delivered

- New **`docs/backend-architecture.md`** recording:
  - modular monolith (no microservices without a concrete operational need);
  - approved top-level structure
    (`modules/`, `infrastructure/`, `common/`, `scripts/`, `app.module.ts`,
    `bootstrap.ts`, `main.ts`) and responsibilities;
  - module ownership (controller/service/mapper/module config kept local; no
    global mixed-domain folders);
  - thin-controller rule;
  - service guidance and "keep simple modules simple";
  - local complexity growth (illustrative `modules/receipts/` example, explicitly
    not implemented/approved);
  - Prisma/repository policy (direct Prisma OK for simple modules; repositories/
    ports only for a real need);
  - auth/access boundary (`modules/auth` vs `modules/access` vs
    `common/guards|decorators`);
  - `common` safeguard (the "does it understand Partner/Resource/Receipt/Stock/
    Production/Order/Sale?" test);
  - scripts responsibility;
  - cross-module dependency guidance (no cycles; no event bus without need);
  - shared-contracts boundary;
  - future workflow modules (goods receipt/stock/production/orders/sales are
    future modules, not folded into resources/partners);
  - file-placement rule;
  - explicitly **not** done: moving `authenticated-user.ts`, reorganising auth,
    repositories, service splits, renames, DDD/Clean-Architecture folders,
    speculative interfaces.
- **`docs/architecture.md`**: "API module conventions (NestJS)" updated to the
  baseline rules plus a pointer to `backend-architecture.md`.
- **`AGENTS.md`**: "NestJS structure" expanded with the concise durable rule
  (modular monolith; module vs infrastructure vs common vs scripts; thin
  controllers; Prisma allowed; keep simple simple; grow locally; no `common`
  dumping ground) and a pointer to the full document.

## Files changed

`/aitvaras`: `docs/backend-architecture.md` (new), `docs/architecture.md`,
`AGENTS.md`, `tasks/done/ATV-019-backend-architecture-rules.md`.
Workspace: `ops/done/2026-09-21-aitvaras-backend-architecture-rules.md`; updated
`ops/backlog.md`, `ops/current.md`, `docs/system/project-state.md`.
**No backend code, schema, frontend or test changes. No `/sandelys` change.**

## Verification

- `pnpm verify` → **exit 0** (lint, prisma validate, typecheck, tests, builds).
  Tests unchanged: web 11/47, API 16/106, contracts 5/26.
- Only documentation/architecture-governance changes from O-056 were added.
- O-051 (partners), O-052 (resources/packing forms) and O-055 (frontend FSD-lite)
  uncommitted work remains preserved.
- `/sandelys` (`alfasis-next`) clean (`git status --short` empty,
  `git diff --check` exit 0).
- `git diff --check` exit 0.

## Next step

None confirmed.
