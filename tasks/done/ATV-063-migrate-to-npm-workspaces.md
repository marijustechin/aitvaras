# ATV-063 — Migrate the workspace fully to npm

- **Status:** Committed and pushed to `main`
- **Scope:** npm workspace configuration, lockfile, scripts, tooling, active docs
- **Related:** ATV-061 audit; `docs/development.md`

## Why

The repository described an npm command convention while still being a pnpm
workspace (`packageManager: pnpm`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`,
pnpm-based scripts and test migration helper). npm could not install the project
from scratch. The follow-up removes that ambiguity and makes npm the only
supported install/run path.

## Implemented

- Root `package.json`:
  - `workspaces: ["apps/*", "packages/*"]`;
  - `packageManager: "npm@12.2.2"`, `engines.npm >= 10`;
  - scripts rewritten to `npm run` / `npm run --workspace` / `npm run
    --workspaces`;
  - explicit `build:libs` → API → web order;
  - `allowScripts` approvals pinned for `prisma@7.10.0`,
    `@prisma/engines@7.10.0`, `esbuild@0.28.2` (npm 12 blocks install scripts
    by default).
- Internal dependencies changed from `workspace:*` to `"*"` so npm resolves the
  local workspace packages through the root workspace map. Package versions
  themselves are unchanged at `0.0.0`.
- Removed `pnpm-workspace.yaml` and `pnpm-lock.yaml`; added the single root
  `package-lock.json`.
- Test-db helper now invokes `npm run db:test:migrate` and `npm exec -- prisma`,
  not pnpm.
- Active docs (README, AGENTS, development, testing, authentication, migration
  history, project context) use npm install/run commands. Historical task
  records remain unchanged.
- TypeScript pinned workspace-wide to **6.0.2** because
  `@nestjs/schematics@12` peer-requires `typescript >= 6`. This is an
  unavoidable resolution change from 5.9.3. The shared tsconfig uses
  `ignoreDeprecations: "6.0"` for the existing `moduleResolution: node` until a
  separate Node16/bundler migration.

## Verification from a clean separate copy

A fresh copy without `node_modules`, `.next` or `dist` was created under
`C:\Users\msmig\AppData\Local\Temp\opencode\aitvaras-npm-ci`.

```text
npm ci          -> installed 491 packages
npm run verify  -> passed
  lint, Prisma validate, typecheck, tests, builds
  contracts 104, web 283, API 245
```

The same `npm ci` + `npm run verify` was then executed in the working repository
after replacing the old pnpm `node_modules`; it also passed with the same counts.

Development startup verification:
- `npm run dev:api` — Nest API started; `GET /health` returned **200**
  `{"status":"ok","service":"aitvaras-api"}`.
- `npm run dev:web` — Next.js web started on port 3011; `GET /login` rendered
  the Aitvaras login screen (`Prisijungti`, `Naudotojo vardas`, `Slaptažodis`).
- No pnpm binary is required for install, verify or startup.

## Resolution changes reported

- **TypeScript 5.9.3 → 6.0.2** (required by Nest schematics 12 peer dependency).
- **`workspace:*` → `*`** for internal workspace package dependencies (npm’s
  supported local-workspace resolution form).
- npm lockfile replaces pnpm lockfile; dependency versions otherwise preserved.
- npm 12 install-script allowlist explicitly approves only Prisma engines and
  esbuild.

## Remaining notes

- TS 7 will require replacing `moduleResolution: node`; this is recorded as
  follow-up debt.
- `npm install` may warn about the existing `@cypress/webpack-preprocessor`
  peer tree; it is a warning, not an unresolved install failure, and no force or
  legacy-peer-deps flag is used.
- Existing database data was not reset; migration checks and test DB setup still
  use the same databases.
- The old local dev servers were stopped to free ports 3010/3011 for the
  clean-copy startup check, then the npm-installed working repository was
  restarted with `npm run dev:api` and `npm run dev:web`; both are healthy
  (`/health` 200, `/login` rendered). No database state was changed.
- Final `git diff --check` / `git status` were re-run after the shell recovered;
  the diff check is clean.
- Unrelated concurrent working-tree changes exist under
  `apps/web/public/brand/`, `brand-mark.tsx`, `home-page.tsx` and
  `app-sidebar.tsx` (brand variants + formatting). They are **not** part of
  ATV-062/ATV-063 and were left untouched. A quote-sensitive source-inspection
  assertion in `navigation.test.ts` was made quote-agnostic so verification
  accepts that concurrent formatting without changing behaviour.
