/**
 * Card surfaces that express visual hierarchy:
 *
 * - **work surface** — an active create/edit work area (subtle neutral
 *   background so it stands apart from data).
 *
 * Read-only/list cards use the plain card utility classes directly.
 * Generic surface only — no domain logic.
 */
const CARD_BASE = "rounded-xl border border-border p-6";

/** Active create/edit work area. */
export const WORK_SURFACE_CLASS = `${CARD_BASE} bg-muted`;

/** Work-surface class, with optional extra classes appended. */
export function workSurfaceClass(extra?: string): string {
  return extra ? `${WORK_SURFACE_CLASS} ${extra}` : WORK_SURFACE_CLASS;
}
