# ATV-055 — Sidebar layout and contextual child navigation

- **Status:** done (uncommitted; for human review)
- **Scope:** authenticated application shell, navigation presentation and page-level child navigation
- **Depends on:** existing routes, role model and page content (no business-rule change)

## Objective

Replace the horizontal top navigation with a persistent dark left sidebar on
desktop and a collapsible drawer on narrow screens, and add route-based
horizontal child navigation for section destinations, without changing routes,
permissions, workflows or account actions.

## Implemented

1. **Sidebar shell**
   - `AppShell` now renders `DesktopSidebar` (`lg+`) + compact top bar + a white
     content surface on a light `zinc-100` background. The content occupies the
     remaining width (the old `max-w-4xl` constraint was removed).
   - Sidebar: approved horizontal logo on a white plate, labelled sections
     (`Operacijos`, `Duomenys`, `Administravimas`), inline SVG icons, visible
     active destination (white indicator + elevated dark pill), and the current
     user identity at the bottom. No navigation children are repeated in the
     sidebar.
   - Top bar: mobile drawer trigger, breadcrumb (`Žinynai / Partneriai`),
     current `UserMenu` (profile/logout) on the right. Header is solid white so
     the modal drawer is not constrained by a `backdrop-filter` containing block.
   - Sidebar and content are aligned to the full viewport width (`min-w-0`,
     `flex-1`) rather than a narrow centered column.

2. **Navigation model**
   - `navigation.ts` replaced `NAV_ENTRIES`/dropdown groups with
     `NAV_SECTIONS` → role-filtered destinations with optional route-based
     children: `visibleNavSections`, `activeDestination`, `activeChild`,
     `isDestinationActive`, `isPathWithin`.
   - `Žinynai` → `Partneriai`, `Ištekliai`, `Kategorijos`, `Tara`, `Sandėliai`
     (all existing routes); `Ataskaitos` → `Neatitikimai` (ADMIN);
     `Sistema` → `Naudotojai` (ADMIN). Operational destinations stay plain links.
   - Longest-prefix child matching means exactly one tab is active
     (`/resources/categories` activates `Kategorijos`, not `Ištekliai`).

3. **Contextual horizontal navigation**
   - `shared/ui/section-tabs.tsx` provides `SectionTabsProvider` (fed by the
     shell) and the presentational `<SectionTabs />`.
   - Rendered below each page heading and above content on partners, resources
     (list/create/details/categories/tare), warehouses, discrepancy register/
     details and users. Pages outside a section render nothing.
   - Active child uses `aria-current="page"` + underline; the strip is
     `overflow-x-auto` with `min-w-max`, so it scrolls itself on mobile without
     widening the page.
   - Replaced the previous secondary `Kategorijos`/`Tara` buttons and the
     duplicated back links on those child pages with the single tab strip.

4. **Responsive / accessibility**
   - Below `lg`, the sidebar becomes a modal drawer (`role="dialog"`,
     `aria-modal`, labelled), opened with `aria-expanded`/`aria-controls`.
   - `Escape`, backdrop click and destination choice close it; focus moves into
     the drawer, is trapped on Tab/Shift+Tab, and returns to the trigger.
   - `cursor-pointer` stays enforced app-wide; disabled states unchanged.

## Decisions

- Section destinations are **not** rendered as nested sidebar items: children are
  horizontal tabs only, so the same navigation never appears twice.
- All child navigation is **route-based** (not local tab state), preserving
  direct links, refresh and browser back/forward.
- `Ištekliai` sub-pages (`Kategorijos`, `Tara`) are first-class `Žinynai`
  children because both are existing reference-data routes.
- Kept monochrome styling: no new accent colour; active states use contrast.
- The shell context lives in `shared/ui` so feature pages can render
  `<SectionTabs />` without importing the `widgets` layer (FSD direction).

## Files changed

- `apps/web/src/widgets/app-shell/model/navigation.ts` (new sidebar model/resolvers)
- `apps/web/src/widgets/app-shell/model/navigation.test.ts` (rewritten)
- `apps/web/src/widgets/app-shell/ui/app-shell.tsx` (layout + provider + trail)
- `apps/web/src/widgets/app-shell/ui/app-sidebar.tsx` (new)
- `apps/web/src/widgets/app-shell/ui/nav-icons.tsx` (new)
- `apps/web/src/widgets/app-shell/ui/app-header.tsx` (breadcrumb + drawer)
- `apps/web/src/widgets/app-shell/ui/main-navigation.tsx` (removed)
- `apps/web/src/shared/ui/section-tabs.tsx` (new), `shared/ui/index.ts`
- `apps/web/src/shared/ui/brand-mark.tsx` (`variant="horizontal"` for the rail)
- `apps/web/src/shared/ui/button.test.ts` (child navigation expectations)
- Feature pages: partners (list/new/details), resources (list/new/details),
  resource categories, packaging types, warehouses (list/details),
  discrepancies (register/details), users — each renders `<SectionTabs />`
  below its heading.
- Docs: `AGENTS.md`, `docs/architecture.md`, `docs/frontend-architecture.md`,
  `TODO.md`.

## Verification

Canonical check: **`pnpm verify`** — passed:

- lint (no errors/warnings), Prisma schema validate
- typecheck: contracts/database/web/api
- tests: contracts **91**, web **273**, API **224**
- builds: contracts, database, Next.js web (all 22 routes), Nest API

Browser verification (Playwright against local dev servers, `localdev`):

- `/resources/categories` after refresh: parent `Žinynai`, child `Kategorijos`,
  exactly one tab strip.
- Back/forward: `Partneriai` → `Ištekliai` restored by browser history.
- Mobile 390px: sidebar drawer opens, `Escape` closes it,
  `document.documentElement.scrollWidth === 390` (no page overflow) while the tab
  strip scrolls horizontally.

Screenshots (`docs/screenshots/atv-055/`):

- `desktop-home.png`
- `desktop-child-navigation.png`
- `desktop-no-child-navigation.png`
- `mobile-drawer-open.png`

## Unresolved / next

- No schema, API, permission or business-workflow changes.
- Screenshots were captured from the local dev seed; the Next.js dev indicator
  was hidden for capture only.
- Existing tables can still be cramped on very narrow screens (pre-existing);
  page-level horizontal overflow is prevented, and the child strip scrolls
  independently.
- Ready for human review; no commit/push performed.
