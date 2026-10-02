# Frontend Architecture (FSD-lite)

> Status: **implemented** for `apps/web/src` (task O-055). This is an
> **architecture-only** decision: routing, layering and file placement. It does
> not change API behaviour, database models or UI behaviour.

Aitvaras uses **FSD-lite** — a lightweight, pragmatic adaptation of
Feature-Sliced Design to the **Next.js App Router**. It is deliberately *not*
strict/academic FSD: there is no `pages/` or `processes/` layer, no
`model/api/ui/lib/config` sub-segment in every slice, and no requirement to
create every canonical segment.

## Layers

```text
src/
├── app/        routing + composition (Next.js App Router)
├── widgets/    large reusable application/page composition blocks
├── features/   user actions / use cases
├── entities/   reusable business/domain concepts
└── shared/     domain-agnostic infrastructure, UI and utilities
```

## Responsibility

| Layer | Owns | Does **not** own |
|---|---|---|
| `app` | routing, layouts, route params, minimal page wiring (`page.tsx`) | business/UI implementations |
| `widgets` | large composition blocks (e.g. the application shell) | domain rules or use-case logic |
| `features` | user actions/use cases (login, manage users/partners/resources/packaging types, profile) | reusable domain vocabulary |
| `entities` | domain concepts, label mappings, small read-oriented helpers | feature workflows |
| `shared` | `api/`, `ui/`, `lib/` — domain-agnostic infrastructure and utilities | partner/resource/user-specific logic |

## Dependency direction

```text
app → widgets → features → entities → shared
```

Higher layers may import lower layers; **lower layers must never import higher
layers**. `shared` must not import `entities`/`features`/`widgets`/`app`.
Import only through a slice's public `index.ts` barrel (see below).

No circular imports.

### Documented exception: `features/auth`

Auth state (`AuthProvider`, `useAuth`, `isUnauthorized`) and the auth guard
(`RequireAuth`) are consumed broadly as a foundational cross-cutting concern.
Other slices import them through the public `@/features/auth` barrel. `auth`
itself never imports other features, so this stays acyclic. It is a same-layer
(`features → features`) dependency, not a lower→higher violation.

## Current slices

```text
entities/
  user/              system access-role label summary
  partner/           partner business-role labels/summary
  resource/          resource category labels
  resource-category/ resource-category labels
  packaging-type/    packaging/tare (`Tara`) helpers
  warehouse/         warehouse/location helpers
  receipt/           receipt money formatting
  batch/             batch/package labels, weights, status helpers

features/
  auth/                    AuthProvider, useAuth, RequireAuth, LoginPage, login messages
  user-profile/            ProfilePage (self-service names + password)
  manage-users/            UsersPage + role/state helpers (ADMIN)
  manage-partners/         partners list/create/details + partner form
  manage-resources/        resources list/create/details + resource form
  manage-resource-categories/ managed resource categories (ADMIN)
  manage-packaging-types/  packaging/tare master data (ADMIN)
  manage-warehouses/       warehouses + locations
  manage-batches/          receiving, batches, packages, reconciliation
  home/                    role-aware home

widgets/
  app-shell/     AppShell, AppHeader, AppFooter, MainNavigation, UserMenu,
                 navigation model + active-route detection

shared/
  api/           api-client.ts (ApiError, apiFetch)
  ui/            brand-mark.tsx, password-input.tsx
  lib/           utils.ts, format.ts, password-field.ts, terminology.test.ts
```

Small slices stay flat (a single `partner.ts` + `partner.test.ts`) until real
complexity justifies `model/`, `ui/`, `lib/`. Do not create empty sub-segments
for symmetry.

## Conventions

- **Thin routes.** `app/**/page.tsx` only wires a feature page inside the shell,
  e.g.:
  ```tsx
  import { PartnersPage } from "@/features/manage-partners";
  import { AppShell } from "@/widgets/app-shell";

  export default function Page() {
    return (
      <AppShell>
        <PartnersPage />
      </AppShell>
    );
  }
  ```
  Feature page components return page **content**; the `AppShell` (a widget) is
  applied by the route, keeping `features` from depending on `widgets`.
- **Next.js files stay in `app/`**: `layout.tsx`, `page.tsx`, `globals.css`,
  `[id]/`, `new/`. Route definitions are never moved into features.
- **Imports use the `@/*` alias**, pointing at `src/*`
  (`@/features/manage-partners`, `@/entities/partner`, `@/shared/api`).
- **File names are lowercase kebab-case** (`partner-form.tsx`,
  `partners-page.tsx`, `api-client.ts`).
- **Barrels** (`index.ts`) expose a slice's public API. Keep them shallow; avoid
  deep barrel hierarchies and cycles.
- **No generic dumping grounds.** `src/components/` and `src/lib/` no longer
  exist; domain code lives in `entities`/`features`, generic code in `shared`.

## Button / action hierarchy

One shared hierarchy lives in `shared/ui/button.ts` (`buttonClass` plus the
`*_BUTTON_CLASS` constants). Do not invent one-off colours per page.

- **primary** (`PRIMARY_BUTTON_CLASS`) — the main action of a page/form (solid
  black): `Naujas gavimas`, `Pradėti registruoti`, `Išsaugoti ir spausdinti`,
  `Patvirtinti gavimą`, `Sukurti`.
- **secondary** (`SECONDARY_BUTTON_CLASS`, compact `SECONDARY_NAV_BUTTON_CLASS`) —
  navigation/context/helper actions: filled dark/medium neutral gray with white
  text, lighter than black but still clearly a button. Used for `Kategorijos`,
  `Tara`, `← Ištekliai`, `← Gavimų sąrašas` and comparable actions.
- **outline** (`OUTLINE_BUTTON_CLASS`) — compact neutral row actions
  (`Redaguoti`, `Taisyti`, `Anuliuoti`).
- **destructive** (`DESTRUCTIVE_BUTTON_CLASS`) — irreversible/danger actions
  (solid red), e.g. `Anuliuoti pakuotę`.

Not every link becomes a filled button: apply the hierarchy where the element is
an explicit action/navigation choice. Pointer cursor is enforced app-wide in
`globals.css`.

## Information architecture (top navigation)

Authenticated navigation is defined in
`widgets/app-shell/model/navigation.ts` (`NAV_ENTRIES`) and rendered by
`MainNavigation` — a compact desktop bar with grouped dropdowns and a responsive
`Meniu` disclosure on narrow screens.

- **Operational workflows stay top-level**: `Pradžia`, `Registruoti sandėlyje`
  and `Gavimai` are the primary daily flows and are not buried under parents.
- **`Žinynai`** — master/reference data: `Partneriai`, `Ištekliai`, `Sandėliai`.
- **`Ataskaitos`** — reporting/registers: currently the ADMIN discrepancy register
  `Neatitikimai` (`/reports/discrepancies`, `/reports/discrepancies/[id]`); hidden
  from `WAREHOUSE_WORKER`.
- **`Sistema`** — system administration: `Naudotojai` (later `Nustatymai` and
  other system-admin pages).

Groups are role-filtered; a populated group whose children are all out of scope is
hidden, while a deliberately reserved empty group is still shown. The active child
highlights its parent. Menu visibility is a UI convenience only — server
authorization remains authoritative (`docs/authorization.md`).

## Tests

Tests live next to the code they cover (e.g.
`entities/partner/partner.test.ts`, `features/manage-users/lib/users.test.ts`,
`widgets/app-shell/model/navigation.test.ts`). `shared/lib/terminology.test.ts`
scans the whole user-facing tree for legacy Lithuanian role/status terms. API
e2e tests remain under `apps/api/test/`.

## See also

- [architecture.md](architecture.md) — overall application architecture
- [development.md](development.md) — local setup and commands
- `AGENTS.md` — the durable frontend rule
