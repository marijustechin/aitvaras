# ATV-008 — Integrate Aitvaras brand assets into the web UI

**Status:** done
**Date:** 2026-09-18
**Target repository:** `/aitvaras`
**Workspace ID:** O-041

## Objective

UI branding integration only: use the existing approved Aitvaras logo assets in
the web UI, with the appropriate variant per layout context, preserving the
Lithuanian monochrome direction. No functional, auth, Prisma or API changes.

## Assets used

Location: `apps/web/public/brand/` (used as provided; not regenerated, renamed
or recoloured).

| Asset | Dimensions | Use |
|---|---|---|
| `aitvaras-logo-horizontal.webp` | 1108×218 | wide contexts (login, shell/admin headers, `sm`+) |
| `aitvaras-logo-symbol.webp` | 512×512 | compact contexts (narrow viewports) + favicon/app icon |
| `aitvaras-logo-stacked.webp` | 512×512 | vertically spacious presentation only (unused now) |

Assets are transparent-background and monochrome (near-black/dark grey),
verified legible on the light UI.

## Where each variant is used

- New responsive `components/brand-mark.tsx` (`BrandMark`): renders the **symbol**
  on narrow viewports (`sm:hidden`) and the **horizontal** logo from `sm` up
  (`hidden sm:block`), so only one variant is visible/announced at a time.
- **Login** (`app/login/page.tsx`): `BrandMark` replaces the former plain
  `Aitvaras` text; `Prisijungti` heading and form unchanged.
- **Authenticated shell** (`app/page.tsx`): `BrandMark href="/"` in the header.
- **Admin users** (`app/admin/users/page.tsx`): `BrandMark href="/"` in the header.
- No all-three-variants usage; stacked intentionally unused.

## Favicon / app icon decision

Declared via Next metadata in `app/layout.tsx`:
`icons.icon = "/brand/aitvaras-logo-symbol.webp"`. Modern browsers support WebP
favicons, so **no derived icon asset was created** and no external converter was
used. Documented in `docs/branding.md`.

## Rendering / accessibility

- `next/image` with intrinsic `width`/`height` and CSS `h-* w-auto` (aspect
  ratio preserved, no layout shift, not raw source size); horizontal uses
  `priority`.
- The visible variant has `alt="Aitvaras"`; the hidden variant is `display:none`
  (excluded from the accessibility tree), so the brand is announced once.
  Linked marks also carry `aria-label="Aitvaras"`.

## UI files changed

- `apps/web/src/components/brand-mark.tsx` (new)
- `apps/web/src/app/login/page.tsx`
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/layout.tsx` (metadata icons)
- `docs/branding.md` (new), `README.md`, `docs/architecture.md`, `AGENTS.md`

## Verification

- `pnpm verify` → **exit 0** (lint, prisma validate, typecheck, tests, builds);
  `next build` produced `/`, `/login`, `/admin/users` without image warnings.
- Served web (`next start --port 3011`):
  - `GET /login` 200 and references both the horizontal and symbol assets; no
    placeholder `Aitvaras` markup remains (only `<title>`/alt text).
  - `GET /` 200.
  - `GET /brand/{horizontal,symbol,stacked}.webp` → **HTTP 200**,
    `image/webp`, byte sizes matching source files.
- Responsive behavior implemented via the symbol/horizontal breakpoint swap.

## Limitations

- Stacked logo unused for now (no vertically-spacious brand context).
- WebP favicon support depends on the browser; a derived icon can be added later
  if a specific platform requires it.
- No automated visual-regression suite (not warranted).

## Next step

No new scope. Auth hardening (rate limiting; http-only cookie) remains the open
candidate from prior tasks.
