import { ROLE_LABELS, type RoleKey } from "@aitvaras/contracts";

/**
 * Lithuanian label summary for a user's **system access roles**.
 *
 * System access roles (`ADMIN`, `WAREHOUSE_WORKER`, …) are deliberately kept
 * separate from partner business roles (Tiekėjas / Pirkėjas).
 */
export function userRolesSummary(roles: readonly RoleKey[]): string {
  return roles.map((key) => ROLE_LABELS[key]).join(", ");
}
