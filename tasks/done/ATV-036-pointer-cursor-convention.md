# ATV-036 — Pointer cursor convention

- **Status:** done (uncommitted; for human review)
- **Scope:** small UI-convention cleanup
- **Depends on:** ATV-030…ATV-035 surfaces

## Objective

Make interactive buttons consistently use a pointer cursor app-wide, and record
the convention permanently. No redesign, colours or sizing changes.

## Where the rule was implemented

The project has **no shared `Button` component** (shadcn is configured via
`components.json`, but buttons are raw `<button>` elements with inline Tailwind
classes). The clean shared place is therefore the Tailwind base layer:

- `apps/web/src/app/globals.css` (`@layer base`) now sets:
  ```css
  button:not(:disabled),
  [role="button"]:not([aria-disabled="true"]) {
    cursor: pointer;
  }
  ```
  This applies to the whole app in one place (no scattered `cursor-pointer`
  classes) and excludes disabled controls, which keep their default/disabled
  cursor semantics. No colour, size or layout change.

All ATV-030–035 receiving-flow actions (`Išsaugoti`, `Išsaugoti ir spausdinti`,
`Spausdinti`, `Nauja partija`, `Kita partija`, and other buttons) are covered by
this single rule.

## Where the convention was documented

`AGENTS.md` → **UI style** section: an explicit rule that all clickable
buttons/actions must use `cursor-pointer`, shadcn defaults are not sufficient,
disabled controls retain their disabled cursor, and the rule is enforced once in
`globals.css` (do not scatter it per button).

## Files changed

- `apps/web/src/app/globals.css` (base-layer pointer-cursor rule);
- `AGENTS.md` (convention);
- `TODO.md` (ATV-036 entry); this record.

No application/TS/contracts/API/DB change.

## Verification

- `pnpm verify` green: lint, Prisma validate, typecheck, contracts **66** / web
  **184** / API **173**, Next + Nest builds (the CSS compiles under Tailwind v4).
- `git diff --check` clean.
- `/sandelys` untouched; no commit/push.

## Limitations

- As there is no shared `Button` component, the rule lives in the global base
  layer; if a shadcn `Button` is generated later, keep `cursor-pointer` in its
  base variant too (the global rule remains a safe backstop).
