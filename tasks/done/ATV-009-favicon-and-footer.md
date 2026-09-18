# ATV-009 — Favicon and footer polish before initial commit

**Status:** done
**Date:** 2026-09-18
**Target repository:** `/aitvaras`
**Workspace ID:** O-042

## Objective

Small pre-commit UI polish: use the new light-background favicon, add a minimal
footer, expose the app version from a single source of truth, and preserve the
Lithuanian monochrome design. No functional/auth/Prisma/API changes.

## Favicon

- New asset `apps/web/public/brand/aitvaras-logo-favicon.webp` (512×512,
  light background) replaces the symbol as the browser/app icon, so the mark is
  visible in both light and dark browser chrome.
- Declared via Next metadata: `icons.icon = "/brand/aitvaras-logo-favicon.webp"`.
- The in-app UI assets are unchanged (`horizontal`/`symbol`/`stacked`); the
  favicon asset is used only for favicon/app-icon purposes.
- No derived icon file was needed (WebP favicon is supported by modern
  browsers); documented in `docs/branding.md`.

## Footer and version

- New component `apps/web/src/components/layout/app-footer.tsx` renders a
  semantic `<footer>`:
  `© Alfasis UAB · Aitvaras v{version}` — small, muted grey, centered, not fixed.
- Rendered once via the **root layout** (below a `flex-1` content wrapper), so it
  appears on login, the authenticated shell, admin and not-found without
  duplication. Page `<main>` elements use `flex-1` (not `min-h-screen`) so the
  footer sits at the bottom without forcing scroll or overlapping content.
- **Single source of truth:** workspace root `aitvaras/package.json` `version`,
  now set to `0.1.0`. `apps/web/next.config.ts` reads it at build time and injects
  `NEXT_PUBLIC_APP_VERSION` (build constant; no runtime lookup or API call). The
  footer is not hardcoded.

## Files changed

`/aitvaras`: `package.json` (version → 0.1.0); `apps/web/next.config.ts`;
`apps/web/src/app/layout.tsx`; `apps/web/src/components/layout/app-footer.tsx`
(new); `apps/web/src/app/{login/page.tsx,page.tsx,admin/users/page.tsx}` (main
layout `flex-1`); `apps/web/public/brand/aitvaras-logo-favicon.webp` (provided,
untracked); `docs/branding.md`.
Task trail: `tasks/done/ATV-009-favicon-and-footer.md`,
`ops/done/2026-09-18-aitvaras-favicon-and-footer.md`; brief notes in
`TODO.md`, `docs/system/project-state.md`, `ops/backlog.md`, `ops/current.md`.
**No `/sandelys` change.**

## Verification

- `pnpm verify` → **exit 0** (lint, prisma validate, typecheck, 40 tests,
  `nest build`, `next build`).
- Built pages (`index.html`, `login.html`, `users.html`, `_not-found.html`) each
  contain the footer `© Alfasis UAB · Aitvaras v0.1.0` and
  `<link rel="icon" href="/brand/aitvaras-logo-favicon.webp">`.
- Served web (`next start --port 3011`): `GET /login` 200 (favicon ref + footer),
  `GET /` 200 (footer), `GET /brand/aitvaras-logo-favicon.webp` → **HTTP 200**
  (`image/webp`, 8682 B).
- Version matches the canonical root `package.json` (`0.1.0`).
- `/sandelys` clean.

## Limitations

- WebP favicon support is browser-dependent; a derived `.ico` could be added
  later if a specific platform requires it.
- `_global-error` (framework error boundary) intentionally does not render the
  app layout/footer.

## Next step

No new scope. Auth hardening remains the open candidate.
