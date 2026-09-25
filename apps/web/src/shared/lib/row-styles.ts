/**
 * Shared visual treatments for active/inactive master data.
 *
 * Inactive rows are de-emphasized with muted text (deliberately, not via row
 * opacity, so interactive controls stay legible). The action that *disables*
 * something is destructive; the action that *enables* it is neutral (never
 * bright green). Generic visual helpers only — no domain logic.
 */

/** Muted text treatment applied to an inactive row. */
export const INACTIVE_ROW_CLASS = "text-muted-foreground";

/** Restrained destructive intent for a `Išjungti` action. */
const DESTRUCTIVE_INTENT =
  "border-destructive/40 text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40";

/** Neutral intent for an `Įjungti` action. */
const NEUTRAL_INTENT =
  "border-border hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const TABLE_SIZE = "px-2 py-1 text-xs";
const DETAIL_SIZE = "px-3 py-2 text-sm";

/** Restrained destructive styling for a table `Išjungti` action. */
export const DISABLE_ACTION_CLASS = `rounded-md border ${DESTRUCTIVE_INTENT} ${TABLE_SIZE}`;

/** Neutral styling for a table `Įjungti` action. */
export const ENABLE_ACTION_CLASS = `rounded-md border ${NEUTRAL_INTENT} ${TABLE_SIZE}`;

/** Row text class: muted for inactive rows, unchanged for active rows. */
export function inactiveRowClass(active: boolean): string {
  return active ? "" : INACTIVE_ROW_CLASS;
}

/** Class for a disable (`Išjungti`) table action. */
export function disableActionClass(): string {
  return DISABLE_ACTION_CLASS;
}

/** Class for an enable (`Įjungti`) table action. */
export function enableActionClass(): string {
  return ENABLE_ACTION_CLASS;
}

/**
 * Class for an activate/deactivate toggle: destructive while the record is
 * active (the action disables it), neutral while it is inactive.
 *
 * `size` selects table-row sizing (default) or detail-level sizing. Both share
 * the same destructive/neutral intent so detail and row actions stay consistent.
 */
export function toggleActionClass(
  active: boolean,
  size: "table" | "detail" = "table",
): string {
  const intent = active ? DESTRUCTIVE_INTENT : NEUTRAL_INTENT;
  const sizing = size === "detail" ? DETAIL_SIZE : TABLE_SIZE;
  return `rounded-md border ${intent} ${sizing}`;
}
