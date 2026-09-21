# ATV-011 — Login UX correction, dev login verification and env cleanup

**Status:** done
**Date:** 2026-09-18
**Target repository:** `/aitvaras`
**Workspace ID:** O-045

## Objective

Small auth UX / local-development reliability correction: fix the inverted
password-visibility icon, ensure the canonical local login works reliably,
diagnose the prior failure, add a development-only login hint, separate
`seed:dev` from `bootstrap:admin` clearly, and tidy local env expectations —
without weakening auth hardening or bootstrap security.

## Root cause of the login failure

`apps/api/test/seed-dev.e2e.test.ts` deleted the canonical `localdev` user in its
`beforeAll`/`afterAll` cleanup. Because the test suite runs against the local/dev
PostgreSQL database, running `pnpm verify`/`pnpm test` removed `localdev`, so
`localdev / localdev` then failed. The account itself was valid (active, ADMIN,
password verifies); this was test data hygiene, not a seed, DB, CORS, lockout, or
UI defect. (The O-044 first smoke attempt hit exactly this.)

**Fix:** the seed suite is now **non-destructive** — it seeds idempotently and
asserts the result without deleting the account, so `localdev` survives test
runs. Verified: `localdev` is still active/ADMIN after a full `pnpm verify`.

## Changes

- **Password toggle semantics corrected:** hidden → `type="password"` + crossed
  eye (`EyeOff`) + `aria-label="Rodyti slaptažodį"`; visible → `type="text"` +
  open eye (`Eye`) + `aria-label="Slėpti slaptažodį"`. Button remains
  `type="button"`; focus/keyboard/password-manager compatibility preserved.
- **Development-only login hint:** muted `Lokali paskyra: localdev / localdev`
  shown when `NODE_ENV === "development"`; absent from production builds.
- **Error mapping:** 401 → `Neteisingas naudotojo vardas arba slaptažodis.`;
  network/server failures → `Nepavyko prisijungti prie serverio. Bandykite dar kartą.`
  (generic auth failures remain indistinguishable).
- **Login UI helpers extracted** to `apps/web/src/lib/login-ui.ts`
  (`passwordFieldState`, `loginErrorMessage`, `shouldShowDevLoginHint`) with unit
  tests (`apps/web/src/lib/login-ui.test.ts`); web now runs Vitest.
- **Disabled Next dev agent-file generation** (`agentRules: false` in
  `next.config.ts`) after `next dev` created `apps/web/AGENTS.md` and
  `CLAUDE.md`; those generated files were removed.
- **Local `.env` cleanup:** `BOOTSTRAP_ADMIN_*` commented out (they are optional
  and not required for normal development); `.env.example` documents this
  explicitly. `seed:dev` does not depend on them.
- **Docs:** `development.md`, `authentication.md`, `README.md` clarify
  `seed:dev` (local-only weak `localdev`) vs `bootstrap:admin` (optional, secure,
  external credentials, never default local credentials).

## Files changed

`/aitvaras`: `apps/web/src/lib/login-ui.ts` (+test), `apps/web/src/app/login/page.tsx`,
`apps/web/{package.json,vitest.config.mts,next.config.ts}`, `apps/web/next-env.d.ts`
(normalised by build), `apps/api/test/seed-dev.e2e.test.ts`,
`.env.example`, `AGENTS.md`, `README.md`,
`docs/{development,authentication}.md`; `tasks/done/ATV-011-login-ux-dev-verification.md`.
Workspace: `ops/done/2026-09-18-aitvaras-login-ux-dev-verification.md`; updated
`docs/system/project-state.md`, `ops/backlog.md`, `ops/current.md`,
`/aitvaras/TODO.md`.
**No tracked `/sandelys` change.**

## Verification

- `pnpm verify` → **exit 0** (lint, prisma validate, typecheck, tests incl. 5 new
  web unit tests, `nest build`, `next build`).
- `localdev` exists/active/ADMIN after the full suite; `pnpm seed:dev` idempotent.
- Live smoke: `POST /auth/login` (`localdev`/`localdev`) → 200 with safe user,
  cookie set; `/auth/me` via cookie → 200; `POST /auth/logout` → 200; `/auth/me`
  after logout → 401.
- Production `login.html`: **no** dev hint; hidden-state eye-off control and
  correct aria-label present. Dev server (`next dev`): hint present; no agent
  files created.
- `git diff --check` clean; no secrets staged.

## Limitations

- Dev hint is keyed on `NODE_ENV`; production builds omit it.
- `/sandelys` still contains two untracked pnpm-generated files that predate this
  task; left untouched (not modified), no tracked change.
- No refresh tokens / rate-limit store changes (unchanged from ADR-011).

## Next step

None confirmed.
