# Branding

## Brand assets

Approved Aitvaras logo assets live in `apps/web/public/brand/`:

| File | Dimensions | Meaning |
|---|---|---|
| `aitvaras-logo-horizontal.webp` | 1108×218 | Icon + `AITVARAS` wordmark, horizontal |
| `aitvaras-logo-symbol.webp` | 512×512 | Icon/symbol only |
| `aitvaras-logo-stacked.webp` | 512×512 | Icon above wordmark, vertical |
| `aitvaras-logo-favicon.webp` | 512×512 | Light-background favicon/app icon (see below) |

All are transparent-background, monochrome (near-black/dark grey) and legible on
the light UI. They must **not** be regenerated, recoloured, renamed or replaced
without an explicit requirement.

## Usage convention

```text
aitvaras-logo-horizontal.webp
→ wide contexts: login, authenticated shell header, admin page header (sm+)

aitvaras-logo-symbol.webp
→ compact contexts: narrow/mobile viewports, favicon/app mark

aitvaras-logo-stacked.webp
→ vertically spacious brand presentation only (not normal navigation)
```

Do not use all three variants arbitrarily on the same page. The responsive
`BrandMark` component (`apps/web/src/components/brand-mark.tsx`) renders the
symbol on narrow viewports and the horizontal logo from the `sm` breakpoint up,
so only one variant is visible (and announced) at a time. It is used on the
login screen, the authenticated shell and the admin users page.

Rendering uses `next/image` with explicit intrinsic `width`/`height` and CSS
`h-* w-auto`, preserving aspect ratio and avoiding layout shift; the logo is not
rendered at raw source size.

## Favicon / app icon

The browser/app icon is `aitvaras-logo-favicon.webp` — a dedicated
**light-background** mark so it stays visible against both light and dark
browser/system chrome. It is declared via Next.js metadata
(`icons.icon = /brand/aitvaras-logo-favicon.webp`). Modern browsers support WebP
favicons, so **no derived icon asset was created**. This asset is used **only**
for favicon/app-icon purposes; the in-app UI keeps the horizontal/symbol/stacked
logos. If a specific platform later requires a format WebP cannot serve, derive a
compatible asset locally (do not use an external converter/service) and document
it.

## Footer and version

A minimal footer (`apps/web/src/components/layout/app-footer.tsx`) renders on
every screen via the root layout:

```text
© Alfasis UAB · Aitvaras v{version}
```

The version is **not hardcoded** in the component. The single source of truth is
the workspace root `aitvaras/package.json` (`version`), read at build time by
`apps/web/next.config.ts` and injected as the build constant
`NEXT_PUBLIC_APP_VERSION` (no runtime API/env lookup). Update the version in
root `package.json` only; the footer follows.

## Design direction

The UI stays minimalist, high-contrast **monochrome** (white/black/grey); colour
is reserved for semantic meaning. No unrelated brand colours, gradients, shadows
or decorative backgrounds are introduced around the logo, and the source assets
are not recoloured.

## Related

- `apps/web/src/components/brand-mark.tsx`
- `docs/architecture.md` (UI language, style and migrations)
- `AGENTS.md` (brand-assets rule)
