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
  app-shell/     AppShell, AppHeader (mobile drawer + breadcrumb), AppSidebar,
                 UserMenu, AppFooter, navigation model + active-route detection

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
  black): `Naujas priėmimas`, `Pradėti registruoti`, `Išsaugoti ir spausdinti`,
  `Patvirtinti priėmimą`, `Sukurti`.
- **secondary** (`SECONDARY_BUTTON_CLASS`, compact `SECONDARY_NAV_BUTTON_CLASS`) —
  navigation/context/helper actions: filled dark/medium neutral gray with white
  text, lighter than black but still clearly a button. Used for `Kategorijos`,
  `Tara`, `← Ištekliai`, `← Priėmimų sąrašas` and comparable actions.
- **outline** (`OUTLINE_BUTTON_CLASS`) — compact neutral row actions
  (`Redaguoti`, `Taisyti`, `Anuliuoti`).
- **destructive** (`DESTRUCTIVE_BUTTON_CLASS`) — irreversible/danger actions
  (solid red), e.g. `Anuliuoti pakuotę`.

Not every link becomes a filled button: apply the hierarchy where the element is
an explicit action/navigation choice. Pointer cursor is enforced app-wide in
`globals.css`.

## Shared notifications, scroll-to-top and labels

- **Notifications:** one `ToastProvider` is mounted in the root layout and is the
  **single convention for every user-action notification**: required/invalid/
  conflicting fields (including client validation that prevents a request),
  save/create/update/void/confirm results, confirmations and API/network errors.
  Colours are fixed by tone: yellow informational, green success, red
  errors/warnings. Identical tone+message pairs are de-duplicated; errors stay
  longer and are dismissible. Show one useful notification per attempt — a
  concise summary naming the affected fields when several fail — and never toast
  on every keystroke. Invalid fields keep their error border/`aria-invalid` and
  the first invalid field receives focus; entered values survive a failed submit.
  Inline action-error banners are removed. Permanent explanatory content,
  load/not-found states and decision dialogs may stay inline. There are no
  browser `alert`s. A browser print dialog opening is not reported as successful
  physical printing.
- **Scroll-to-top:** `ScrollToTop` is mounted once in `AppShell`. The control is a
  white circular button with a black border and a black upward arrow only (no
  visible text); `Į viršų` remains its accessible label and tooltip. It keeps a
  visible keyboard focus ring and an adequate click target. It appears after
  320px in the actual vertically scrollable container (or document), hides near
  the top/short pages, recalculates on scroll, resize, route and content-height
  changes, and honours `prefers-reduced-motion`.
- **Tare labels:** selectors use `packagingTypeOptionLabel` →
  `Pavadinimas (svoris kg)` with Lithuanian, minimum-one-decimal formatting
  (e.g. `Dėžė (0,2 kg)`); option IDs and calculations are unchanged.
- **Voided labels:** `canPrintLabel(status)` gates label actions. Voided bags are
  rendered with a genuinely disabled `Etiketė` control; reprint handlers also
  reject non-active units, so keyboard/mouse/direct state paths cannot print a
  voided label.

## Information architecture (sidebar + contextual child navigation)

Authenticated navigation is defined in
`widgets/app-shell/model/navigation.ts` (`NAV_SECTIONS`) and rendered by
`AppSidebar` / `AppHeader`.

- **Desktop** uses a persistent dark left sidebar; narrow screens replace it with
  a modal drawer opened from the top bar (`Escape`, backdrop click and choosing a
  destination close it; focus is trapped and returned to the trigger).
- **Operacijos** — daily operational flows: `Suvestinė` and `Priėmimas` are plain
  destinations. `Priėmimas` covers the received-batch list (`/receipts`) and the
  new-receipt workflow (`/receiving`, `/receiving/new`, delivery/batch detail).
- **Duomenys / Žinynai** — one section destination whose existing reference-data
  pages render as horizontal child navigation below the heading:
  `Partneriai`, `Ištekliai`, `Kategorijos`, `Tara`, `Sandėliai`.
- **Administravimas / Ataskaitos** — the ADMIN discrepancy register
  `Neatitikimai` (`/reports/discrepancies`, `/reports/discrepancies/[id]`); hidden
  from `WAREHOUSE_WORKER`.
- **Administravimas / Nustatymai** — installation settings as horizontal children:
  `Įmonė` (`/settings/company`, the operator's own company details, ADMIN-only
  editing) and `Naudotojai` (`/admin/users`, existing user administration). The
  company record is shared, not per-user or browser-local; see
  `docs/company-settings.md`.

Child navigation is **route-based**: the active child is the most specific child
href matching the pathname, so direct links, refreshes and browser
back/forward navigation restore the correct sidebar destination and tab.
`AppShell` computes the active destination and provides it through
`SectionTabsProvider` (`shared/ui/section-tabs.tsx`); feature pages render the
presentational `<SectionTabs />` after their heading. Pages outside a section
render nothing, and the same children are not repeated in the sidebar.

Destinations are role-filtered; a destination whose declared children are all
out of scope is hidden, and empty sections are dropped. Menu visibility is a UI
convenience only — server authorization remains authoritative
(`docs/authorization.md`).

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
