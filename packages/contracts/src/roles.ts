import { z } from "zod";

/**
 * Stable semantic role identifiers.
 *
 * These are the four confirmed initial roles. They are configuration, not
 * legacy semantics: no numeric ids and no implicit meaning. Persisted as the
 * `Role.key` value.
 */
export const ROLE_KEYS = [
  "ADMIN",
  "WAREHOUSE_WORKER",
  "ACCOUNTING",
  "PRODUCTION_MANAGER",
] as const;

export const RoleKeySchema = z.enum(ROLE_KEYS);

export type RoleKey = z.infer<typeof RoleKeySchema>;

/** Human-readable labels (Lithuanian), for display only. */
export const ROLE_LABELS: Record<RoleKey, string> = {
  ADMIN: "Administratorius",
  WAREHOUSE_WORKER: "Sandėlio darbuotojas",
  ACCOUNTING: "Apskaita",
  PRODUCTION_MANAGER: "Gamybos vadovas",
};

/** The initial role catalogue seeded into the database. */
export const ROLE_CATALOG: ReadonlyArray<{ key: RoleKey; name: string }> =
  ROLE_KEYS.map((key) => ({ key, name: ROLE_LABELS[key] }));

/**
 * Normalise a role set for assignment.
 *
 * `ADMIN` includes full application access, so it **dominates**: when present
 * it is stored alone. Otherwise roles are de-duplicated in catalogue order.
 * This is the single rule shared by the API (server-side normalization) and the
 * web UI; never rely on the UI alone.
 */
export function normalizeRoleKeys(roles: readonly RoleKey[]): RoleKey[] {
  const unique = new Set(roles);
  if (unique.has("ADMIN")) {
    return ["ADMIN"];
  }
  return ROLE_KEYS.filter((key) => unique.has(key));
}
