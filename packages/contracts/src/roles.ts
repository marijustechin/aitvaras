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
