/**
 * Card surfaces that express visual hierarchy:
 *
 * - **work surface** — an active create/edit work area (subtle neutral
 *   background so it stands apart from data);
 * - **default surface** — list/history and read-only/detail cards (default
 *   white card).
 *
 * Generic surfaces only — no domain logic.
 */
const CARD_BASE = "rounded-xl border border-border p-6";

/** Active create/edit work area. */
export const WORK_SURFACE_CLASS = `${CARD_BASE} bg-muted`;

/** Default/list/read-only surface. */
export const DEFAULT_SURFACE_CLASS = `${CARD_BASE} bg-card`;

/** Work-surface class, with optional extra classes appended. */
export function workSurfaceClass(extra?: string): string {
  return extra ? `${WORK_SURFACE_CLASS} ${extra}` : WORK_SURFACE_CLASS;
}

/** Default-surface class, with optional extra classes appended. */
export function defaultSurfaceClass(extra?: string): string {
  return extra ? `${DEFAULT_SURFACE_CLASS} ${extra}` : DEFAULT_SURFACE_CLASS;
}
