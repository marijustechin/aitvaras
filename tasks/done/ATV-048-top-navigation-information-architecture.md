# ATV-048 — Top-navigation information-architecture cleanup

- **Status:** done (uncommitted; for human review)
- **Scope:** group top-level admin/reference navigation under clear parents
- **Depends on:** existing app shell (`widgets/app-shell`)

## Objective

Group existing top-level navigation under clearer parent concepts without
changing routes, authorization or page content: `Žinynai` (reference data),
`Ataskaitos` (reports/registers, reserved) and `Sistema` (system administration),
while keeping the daily operational workflows top-level. No discrepancy reports
yet.

## 1. New hierarchy

```text
Pradžia                     (link, top-level)
Registruoti sandėlyje       (link, top-level; receiving roles)
Gavimai                     (link, top-level; non-worker)
Žinynai                     (group)
  ├── Partneriai            /partners
  ├── Ištekliai             /resources
  └── Sandėliai             /warehouses
Ataskaitos                  (group, reserved — no children yet)
Sistema                     (group; ADMIN)
  └── Naudotojai            /admin/users
```

The model (`widgets/app-shell/model/navigation.ts`) now has a discriminated
`NavEntry` (`kind: "link" | "group"`), `NAV_ENTRIES`, `visibleNavEntries(roles)`,
`isNavItemActive` and `isNavGroupActive`. `Ataskaitos` is a deliberately empty
group rendered with the `EMPTY_GROUP_LABEL` ("Ruošiama") state.

## 2. Desktop behavior

`MainNavigation` renders a compact horizontal bar (`hidden md:flex`). Parent
items are `<button>` triggers with `aria-haspopup="menu"`, `aria-expanded` and a
chevron; their dropdown is a sibling `role="menu"` list of child `<Link>`s (no
nested interactive elements). The dropdown closes on route change, outside click
and `Escape` (same pattern as `UserMenu`). An active child makes the parent render
active (bold + underline). Pointer cursor comes from the app-wide base rule.

## 3. Responsive behavior

Below `md`, the bar is replaced by a `Meniu` disclosure (`md:hidden`): a
`<button aria-expanded aria-controls="mobile-navigation">` toggling a full-width
panel anchored under the header (header made `relative`). The panel lists the same
role-filtered entries, groups as labelled sections with indented child links, and
the "Ruošiama" state for the reserved group. No stale flat navigation remains at
any breakpoint.

## 4. Role visibility

Preserved: `Žinynai` is visible to every authenticated user (it is not an
admin-only area today); `Gavimai` and `Ataskaitos` are hidden from
`WAREHOUSE_WORKER`; `Sistema`/`Naudotojai` are `ADMIN`-only. `Registruoti
sandėlyje` is receiving-roles only. A populated group whose children are all out
of scope is hidden; the reserved empty group is still shown to allowed roles.
Menu hiding is a UI convenience only — server authorization is unchanged and
remains authoritative.

## 5. Routes preserved

`/`, `/partners`, `/resources`, `/warehouses`, `/receiving`, `/receipts`,
`/admin/users` are unchanged in href and authorization. No route files were
touched; only navigation wiring (the header `relative` class) changed.

## Files changed

- `apps/web/src/widgets/app-shell/model/navigation.ts` (grouped model +
  `visibleNavEntries`/`isNavGroupActive`; `visibleNavItems` removed).
- `apps/web/src/widgets/app-shell/model/navigation.test.ts` (rewritten).
- `apps/web/src/widgets/app-shell/ui/main-navigation.tsx` (grouped desktop
  dropdowns + responsive `Meniu` panel).
- `apps/web/src/widgets/app-shell/ui/app-header.tsx` (`relative` for the mobile
  panel anchor).
- Docs: `frontend-architecture.md`, `architecture.md`, `batches.md`, `AGENTS.md`,
  `TODO.md`; this record.

## Verification

- `pnpm verify` green: lint, Prisma validate, typecheck, contracts **80** / web
  **218** / API **204**, Next + Nest builds.
- `git diff --check` clean.
- No schema/migration change (no drift check required).
- `/sandelys` untouched; no commit/push.

## Unresolved / next

`Ataskaitos` stays empty until the reporting slice. The future discrepancy
register/report navigation belongs here (documented). Next slice remains
discrepancy **settlement** (`DiscrepancySettlement`, `WEIGHT`/`MONEY`).
