# ATV-064 — Correct logo variants, background and alignment

- **Status:** Committed and pushed to `main`
- **Scope:** shared brand component, login placement, sidebar/drawer brand header
- **Related:** `docs/branding.md`, `AGENTS.md` brand rule

## Context / concurrent work

The working tree already contained concurrent brand-asset changes:
`aitvaras-logo-horizontal-dark.webp` and `-light.webp` were added, the old
single horizontal asset was removed, and several web files had been reformatted.
Those changes were inspected and incorporated; unrelated formatting/home-page
work was not reverted.

## Implemented

- `BrandMark` now accepts an explicit `variant="dark" | "light"`:
  - `dark` → `aitvaras-logo-horizontal-dark.webp` for light surfaces;
  - `light` → `aitvaras-logo-horizontal-light.webp` for dark surfaces.
- Removed the previous responsive symbol swap and CSS-based behaviour; each
  location now selects its asset directly. No filters, inversion or opacity.
- Login page selects `dark` and centres the logo horizontally above
  `Prisijungti`.
- Desktop sidebar and mobile drawer select `light`; the logo is centred in the
  brand header. The white card background, border, shadow, rounded background
  and padding were removed from the sidebar logo link.
- The close control remains at the right edge, so the logo stays centred on both
  desktop and mobile drawer.
- Link behaviour is unchanged (sidebar logo still links to `/`) and accessible
  names remain `Aitvaras` / `Aitvaras — pradžia`.
- `docs/branding.md` and the AGENTS brand rule now describe the dark/light
  surface selection.

## Verification

Browser checks (Playwright, local dev):

```text
login logo src    → /brand/aitvaras-logo-horizontal-dark.webp; loaded
login centre      → delta 0 px
sidebar logo src  → /brand/aitvaras-logo-horizontal-light.webp; loaded
sidebar centre    → delta 0 px
sidebar wrapper   → transparent background, 0 px border, no shadow, 0 padding
drawer logo src   → /brand/aitvaras-logo-horizontal-light.webp; loaded
drawer centre     → delta 0 px
drawer wrapper    → transparent background
```

Screenshots:
- `docs/screenshots/atv-064/login-logo-dark.png`
- `docs/screenshots/atv-064/sidebar-logo-light.png`
- `docs/screenshots/atv-064/drawer-logo-light.png`

`npm run verify` passed: lint, Prisma validate, typecheck, tests
(contracts **104**, web **283**, API **245**) and builds.

No new screenshot-source assertion tests were added, per request.

## Files changed

- `apps/web/src/shared/ui/brand-mark.tsx`
- `apps/web/src/features/auth/ui/login-page.tsx`
- `apps/web/src/widgets/app-shell/ui/app-sidebar.tsx`
- `docs/branding.md`, `AGENTS.md`, `TODO.md`
- `docs/screenshots/atv-064/`

## Remaining

- Physical print is unrelated and unchanged.
- Concurrent unrelated home/brand formatting changes remain in the working tree
  untouched.
