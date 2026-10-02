/**
 * Shared button / action hierarchy (single source of truth).
 *
 * - **primary** — the main action of a page/form (solid black).
 * - **secondary** — a filled dark/medium neutral gray, used for navigation and
 *   context/helper actions (`Kategorijos`, `Tara`, `← Ištekliai`,
 *   `← Gavimų sąrašas`, ...). Visually lighter than black but clearly a button.
 * - **outline** — compact neutral row actions (e.g. `Redaguoti`).
 * - **destructive** — irreversible/danger actions (solid red).
 *
 * The app-wide pointer-cursor rule lives in `app/globals.css`; do not add
 * `cursor-pointer` per button.
 */
export type ButtonVariant = "primary" | "secondary" | "outline" | "destructive";
export type ButtonSize = "md" | "sm";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium disabled:opacity-60";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  // Dark/medium neutral gray: lighter than black, still clearly a button.
  secondary: "bg-neutral-700 text-white hover:bg-neutral-800",
  outline: "border border-border bg-background text-foreground hover:bg-accent",
  destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  md: "px-4 py-2 text-sm",
  sm: "px-3 py-1.5 text-xs",
};

/** Compose a button class from the shared hierarchy. */
export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  extra?: string,
): string {
  return [BASE, VARIANT_CLASS[variant], SIZE_CLASS[size], extra]
    .filter(Boolean)
    .join(" ");
}

/** Main action of a page/form (solid black). */
export const PRIMARY_BUTTON_CLASS = buttonClass("primary");

/** Navigation / context / helper action (filled neutral gray, medium). */
export const SECONDARY_BUTTON_CLASS = buttonClass("secondary");

/** Compact navigation / child action (filled neutral gray, small). */
export const SECONDARY_NAV_BUTTON_CLASS = buttonClass("secondary", "sm");

/** Compact neutral row action (outline). */
export const OUTLINE_BUTTON_CLASS = buttonClass("outline", "sm");

/** Irreversible/danger action (solid red). */
export const DESTRUCTIVE_BUTTON_CLASS = buttonClass("destructive");
