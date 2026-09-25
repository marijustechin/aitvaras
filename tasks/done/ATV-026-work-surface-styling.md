# ATV-026 — Consistent active-work surface styling

**Status:** done
**Date:** 2026-09-21
**Target repository:** `/aitvaras`
**Workspace ID:** O-064

## Objective

Apply the `Pajamavimas` visual pattern consistently: **active create/edit work
areas use a subtle neutral surface**, while **list/history and read-only areas
stay on the default white card**. No business logic, API or schema changes.

## Reuse

- New `shared/lib/surfaces.ts` (+ test): `WORK_SURFACE_CLASS`
  (`rounded-xl border border-border p-6 bg-muted`), `DEFAULT_SURFACE_CLASS`
  (`... bg-card`), and `workSurfaceClass(extra?)` / `defaultSurfaceClass(extra?)`.
  The closest existing design-system neutral surface to the requested
  `bg-slate-50` — the project has no `slate` palette.
- Work areas now use `className={workSurfaceClass()}` instead of a duplicated
  literal. (A `WorkSurface` component was considered but a light style helper is
  the smaller reuse and avoids restructuring multi-branch sections.)

## Applied (active create/edit work areas)

- **Naudotojai** — `Sukurti naudotoją` and `Redaguoti naudotoją`.
- **Sandėliai** — `Naujas sandėlis`; `Redaguoti sandėlį` (warehouse detail).
- **Partneriai** — `Naujas partneris`; partner edit form (detail edit branch).
- **Ištekliai** — `Naujas išteklius`; resource edit form (detail edit branch).
- **Pakavimo formos** — `Nauja pakavimo forma`.
- **Pajamavimas** — receipt-entry form (now via the shared helper; same look).
- **Mano profilis** — `Paskyros informacija` and `Keisti slaptažodį` (active edit
  forms) for consistency.

## Left on the default/white surface

- List/history tables (`Naudotojų sąrašas`, `Sandėlių sąrašas`, `Partnerių
  sąrašas`, `Išteklių sąrašas`, `Pajamavimų istorija`) and the read-only detail
  cards (`partner-details` / `resource-details` / `receipt-details` read-only
  branches). The pre-auth login card was intentionally left unchanged.

## Do not change (preserved)

Typography, button semantics, form layout, validation, table styling, route
structure, field order. No heavy shadow, no gradient, no new accent colour.

## Accessibility

Inputs/selects keep `bg-background` (white) on the muted card, so input contrast
and disabled-field legibility are preserved; borders keep existing contrast; no
information is conveyed by colour alone.

## Files changed

`shared/lib/surfaces.ts` (+test);
`features/manage-users/ui/users-page.tsx`,
`features/manage-warehouses/ui/{warehouses-page.tsx,warehouse-details-page.tsx}`,
`features/manage-partners/ui/{new-partner-page.tsx,partner-details-page.tsx}`,
`features/manage-resources/ui/{new-resource-page.tsx,resource-details-page.tsx}`,
`features/manage-packing-forms/ui/packing-forms-page.tsx`,
`features/manage-receipts/ui/receipts-page.tsx`,
`features/user-profile/ui/profile-page.tsx`;
`tasks/done/ATV-026-work-surface-styling.md`.

## Verification

- `pnpm verify` → **exit 0**. Tests: API **126 / 18**, web **92 / 16**,
  contracts **38 / 7**.
- Test-DB isolation intact (dev DB fingerprint identical before/after verify).
- `surfaces.test.ts`: work surface uses `bg-muted` (not `bg-card`); default uses
  `bg-card` (not `bg-muted`); both share `rounded-xl`/`border`/`p-6`; extras
  appended.
- `git diff --check` exit 0; no secrets; `/sandelys` clean.

## Next step

None confirmed.
