import type { RoleKey } from "@aitvaras/contracts";

/** Shape attached to the request by `JwtAuthGuard` after token verification. */
export interface AuthenticatedUser {
  id: string;
  username: string;
  roles: RoleKey[];
}
