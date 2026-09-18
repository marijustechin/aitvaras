import type { RoleKey, UserSummary } from "@aitvaras/contracts";

export interface UserWithRolesRecord {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  roles: { role: { key: string } }[];
}

/** Map a database user to the safe public representation. */
export function toUserSummary(user: UserWithRolesRecord): UserSummary {
  return {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    active: user.active,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    roles: user.roles
      .map((assignment) => assignment.role.key as RoleKey)
      .sort(),
  };
}
