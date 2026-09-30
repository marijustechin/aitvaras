import type { RoleKey } from "@aitvaras/contracts";
import { canReceiveStock } from "@/entities/batch";

/**
 * Whether the home page should present the warehouse receiving action.
 *
 * The operational home is for the roles that physically receive stock; other
 * roles keep the generic home content.
 */
export function homeShowsReceivingAction(roles: readonly RoleKey[]): boolean {
  return canReceiveStock(roles);
}
