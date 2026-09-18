import { SetMetadata } from "@nestjs/common";
import type { RoleKey } from "@aitvaras/contracts";

export const ROLES_KEY = "roles";

/** Requires the authenticated user to hold at least one of the given roles. */
export const Roles = (...roles: RoleKey[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
