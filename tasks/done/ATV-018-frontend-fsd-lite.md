# ATV-018 — Web frontend refactor to FSD-lite

**Status:** done
**Date:** 2026-09-21
**Target repository:** `/aitvaras`
**Workspace ID:** O-055

## Objective

Architecture-only refactor of `apps/web/src` toward a lightweight
Feature-Sliced Design (FSD-lite) suited to the Next.js App Router. No business
functionality, API, database or UI behaviour changes.

## Target architecture

```text
src/{app,entities,features,widgets,shared}
app → widgets → features → entities → shared
```

Implemented exactly as specified (no `pages/`/`processes/`).

## Work performed

- **shared/**: `api/api-client.ts` (was `lib/api.ts`), `lib/{utils,format,
  password-field}.ts`, `ui/{brand-mark,password-input}.tsx`,
  `lib/terminology.test.ts`. `format.ts` holds domain-agnostic
  `valueOrPlaceholder`/`activeStatusLabel`; `password-field.ts` holds the
  generic password-visibility state so `shared/ui` does not import a feature.
- **entities/**: `partner/` (business-role labels/summary), `resource/`
  (category labels), `packing-form/` (empty-state text), `user/` (system
  access-role summary) — flat slices, each with an `index.ts` and, where
  meaningful, a co-located test.
- **features/**: `auth/` (`model/auth-provider`, `ui/require-auth`,
  `ui/login-page`, `lib/login-ui`), `user-profile/`, `manage-users/`,
  `manage-partners/`, `manage-resources/`, `manage-packing-forms/`. Form
  helpers moved to `features/*/lib`; page compositions to `features/*/ui`
  (content only — the shell is applied by the route).
- **widgets/app-shell/**: `ui/{app-shell,app-header,app-footer,
  main-navigation,user-menu}.tsx` and `model/navigation.ts` (+ test).
- **app/**: thin routes; each `page.tsx` only wires a feature page inside
  `AppShell` (with `roles={["ADMIN"]}` where required). `layout.tsx` wires
  `AuthProvider` + `AppFooter`.
- Removed the generic `src/components/` and `src/lib/` dumping grounds.
- Updated `components.json` aliases to `@/shared/ui` / `@/shared/lib`.
- Added the `@` alias to `vitest.config.mts` so co-located tests resolve `@/…`.
- Docs: new `docs/frontend-architecture.md`; `AGENTS.md` frontend rule;
  `docs/architecture.md` shell reference updated.

## Dependency-direction notes

- Feature pages return content; `AppShell` (widget) is applied in `app/`, so
  `features` never import `widgets`.
- `features/auth` is imported by other slices as a documented foundational
  cross-cutting concern (same-layer, always acyclic); `auth` imports no other
  feature.
- `shared` imports no higher layer.

## Files changed

`/aitvaras/apps/web`: entire `src` reorganisation (added `entities/`,
`features/`, `widgets/`, `shared/`; removed `components/`, `lib/`; rewrote
`app/**` and `app/layout.tsx`); `components.json`; `vitest.config.mts`.
Docs: `docs/frontend-architecture.md` (new), `docs/architecture.md`,
`AGENTS.md`. Record: `tasks/done/ATV-018-frontend-fsd-lite.md`.

## Verification

- `pnpm verify` → **exit 0** (lint, prisma validate, typecheck, tests, Nest +
  Next build). Routes unchanged: `/`, `/login`, `/profile`, `/admin/users`,
  `/partners`, `/partners/new`, `/partners/[id]`, `/resources`,
  `/resources/new`, `/resources/[id]`, `/resources/packing-forms`.
- Tests: web **11 files / 47 tests**, API **16 / 106**, contracts **5 / 26**
  (all preserved; split where tests moved with their code).
- Test-DB isolation intact (dev DB fingerprint identical before/after verify).
- Smoke (dev API/web): login 200; `/auth/me`, `/users`, `/partners`,
  `/resources`, `/packing-forms` 200; all web routes incl. detail routes 200;
  built client JS contains `Partneriai`, `Ištekliai`, `Naudotojai`,
  `Vaidmenys`, `Įjungti`, `Mano profilis`; logout 200.
- `git diff --check` exit 0; no secrets; `/sandelys` clean.

## Notes

- Behaviour, API, DB and UI are unchanged; this is placement/naming only.
- O-051 (partners) and O-052 (resources/packing forms) remain uncommitted;
  their frontend code was refactored into the new structure without reverting.

## Next step

None confirmed.
