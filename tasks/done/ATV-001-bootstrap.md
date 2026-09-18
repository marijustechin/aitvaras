# ATV-001 — Bootstrap the Aitvaras project and engineering harness

**Status:** done
**Date:** 2026-09-18
**Target repository:** `/aitvaras`

## Objective

Establish Aitvaras as a coherent, independently buildable pnpm workspace with a
minimal working foundation, a documented architectural boundary against the
legacy `/sandelys` system, and a durable engineering/task harness for future
agent-driven work.

## Implemented work

- Confirmed the workspace model: root is a context layer (not a Git repo);
  `/sandelys` and `/aitvaras` are independent repos. Recorded legacy findings
  relevant to Aitvaras.
- Created a pnpm workspace: `apps/api` (NestJS + Fastify), `apps/web` (Next.js
  App Router + Tailwind), `packages/{config,contracts,database}`.
- API exposes `GET /health` returning `{"status":"ok","service":"aitvaras-api"}`,
  typed against a shared Zod contract.
- Web shell with Tailwind v4 design tokens and shadcn/ui-compatible structure
  (`components.json`, `src/lib/utils.ts`); no component catalog installed.
- Prisma/PostgreSQL foundation with an **intentionally empty schema** and a
  config that loads the workspace root `.env` and degrades gracefully when it is
  absent.
- Local-only PostgreSQL via `docker-compose.yml` (named volume, healthcheck,
  bound to `127.0.0.1`).
- Engineering harness: `AGENTS.md`, `README.md`, `TODO.md`, `docs/` and
  `tasks/{current,done}`.
- Canonical `pnpm verify` (lint, Prisma validate, typecheck, test, build).

## Decisions

- Stack baseline recorded in workspace ADR-002 (TypeScript/Node/pnpm, Next.js
  App Router, NestJS + Fastify, PostgreSQL + Prisma, Zod, Vitest).
- Aitvaras owns its own PostgreSQL schema; no legacy tables or conventions.
- No integration protocol is designed yet; the boundary is documented as a
  principle with open questions in `docs/integration-boundaries.md`.
- Database schema stays empty; no fake warehouse entities were created.
- Prisma pinned to stable 6.19.3 (7.x is current but requires a different
  generator/config model; not needed for the foundation). TypeScript pinned to
  5.9.3 because `typescript-eslint@8` does not support TS 7.

## Files changed

All inside `/aitvaras` (new unless noted). The pre-existing `README.md` was
replaced as part of the bootstrap.

- Root: `package.json`, `pnpm-workspace.yaml`, `eslint.config.mjs`,
  `docker-compose.yml`, `.gitignore`, `.env.example`, `README.md`, `AGENTS.md`,
  `TODO.md`.
- `packages/config`: `package.json`, `tsconfig.base.json`, `eslint.base.mjs`.
- `packages/contracts`: `package.json`, `tsconfig.json`, `tsconfig.build.json`,
  `vitest.config.mts`, `src/{index,health,health.test}.ts`.
- `packages/database`: `package.json`, `tsconfig.json`, `prisma.config.ts`,
  `prisma/schema.prisma`, `src/index.ts`.
- `apps/api`: `package.json`, `nest-cli.json`, `tsconfig.json`,
  `tsconfig.build.json`, `vitest.config.mts`, `src/main.ts`,
  `src/app.module.ts`, `src/health/{health.module,health.controller,health.controller.test}.ts`.
- `apps/web`: `package.json`, `next.config.ts`, `tsconfig.json`,
  `next-env.d.ts`, `postcss.config.mjs`, `components.json`,
  `src/app/{layout,page,globals.css}`, `src/lib/utils.ts`.
- `docs/`: `architecture.md`, `project-context.md`, `integration-boundaries.md`,
  `development.md`, `testing.md`.
- `tasks/`: `README.md`, `done/ATV-001-bootstrap.md` (this file).

Workspace root (not a Git repo): `docs/decisions/ADR-002-aitvaras-baseline-stack.md`,
updates to `docs/decisions/README.md`, `docs/system/project-state.md`,
`TODO.md`, `ops/{current,backlog}.md`, and
`ops/done/2026-09-18-aitvaras-bootstrap.md`.

## Verification

- `pnpm install` — clean; only Prisma/esbuild/native build scripts allowed.
- `pnpm verify` — **exit 0**: ESLint, `prisma validate`, typecheck (5 projects),
  Vitest (3 tests), and builds (`nest build`, `next build`, package `tsc`).
- `pnpm db:generate` and `pnpm db:validate` — pass with and without a local
  `.env`.
- `docker compose config -q` — passes.
- Running API: `GET http://127.0.0.1:3001/health` → HTTP 200
  `{"status":"ok","service":"aitvaras-api"}`.
- No `/sandelys` file modified; no commit or push performed.

## Unresolved issues

- The Aitvaras ↔ Sandėlys integration contract is undefined (O-033).
- No confirmed domain requirements yet; the Prisma schema is empty by design.
- Prisma 7+ upgrade, hosting/deployment model, auth strategy — all deferred.
- `packages/database` is not yet imported by the API; that wiring arrives with
  the first persistence feature (avoided as speculative now).

## Recommended next task

**O-033 — Define the Aitvaras ↔ Sandėlys integration contract (ADR)** in the
workspace backlog, then **O-034 — first Aitvaras vertical slice** (deferred).

## Git state

- `/aitvaras`: branch `main`; all bootstrap files **untracked/uncommitted**; no
  commit, no push.
- `/sandelys`: branch `alfasis-next`; unchanged.
- Root: not a Git repository.
