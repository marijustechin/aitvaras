# Branding

## Brand assets

Approved Aitvaras logo assets live in `apps/web/public/brand/`:

| File | Dimensions | Meaning |
|---|---|---|
| `aitvaras-logo-horizontal-dark.webp` | 1108×218 | Dark artwork for **light** backgrounds (login) |
| `aitvaras-logo-horizontal-light.webp` | 1108×218 | Light artwork for **dark** backgrounds (sidebar/drawer) |
| `aitvaras-logo-symbol.webp` | 512×512 | Icon/symbol only |
| `aitvaras-logo-stacked.webp` | 512×512 | Icon above wordmark, vertical |
| `aitvaras-logo-favicon.webp` | 512×512 | Light-background favicon/app icon (see below) |

The horizontal assets are transparent-background variants of the same lock-up.
Select the file by the surrounding surface; never simulate the other variant with
CSS filters, inversion or opacity.

## Usage convention

```text
aitvaras-logo-horizontal-dark.webp
→ light surfaces: login page

aitvaras-logo-horizontal-light.webp
→ dark surfaces: desktop sidebar and mobile drawer brand header

aitvaras-logo-symbol.webp
→ compact favicon/app-mark contexts only

aitvaras-logo-stacked.webp
→ vertically spacious brand presentation only (not normal navigation)
```

The shared `BrandMark` component (`apps/web/src/shared/ui/brand-mark.tsx`) takes an
explicit `variant="dark" | "light"`; callers select it from the actual background.
The login logo is centred above `Prisijungti`; the sidebar/drawer logo is centred
inside the brand header with no white card, border, shadow or rounded background.
Links keep their accessible name `Aitvaras` (sidebar: `Aitvaras — pradžia`).

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

- `apps/web/src/shared/ui/brand-mark.tsx`
- `docs/architecture.md` (UI language, style and migrations)
- `AGENTS.md` (brand-assets rule)
