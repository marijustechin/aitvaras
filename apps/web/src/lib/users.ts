import {
  normalizeRoleKeys,
  type RoleKey,
  type UserSummary,
} from "@aitvaras/contracts";
import { ApiError } from "./api";

/** Label for the activate/deactivate action. */
export function activeToggleLabel(active: boolean): string {
  return active ? "Išjungti" : "Įjungti";
}

/**
 * `Administratorius` includes all application permissions, so the other role
 * controls are redundant (and therefore disabled) while it is selected. The
 * ADMIN control itself always stays enabled.
 */
export function isRoleControlDisabled(
  role: RoleKey,
  roles: readonly RoleKey[],
): boolean {
  return role !== "ADMIN" && roles.includes("ADMIN");
}

/**
 * Toggle a system role for the edit form.
 *
 * Selecting ADMIN clears the other roles (ADMIN dominates). Deselecting ADMIN
 * re-enables the others but does not restore previous selections — predictable
 * behaviour over clever restoration.
 */
export function toggleRoleSelection(
  roles: readonly RoleKey[],
  role: RoleKey,
): RoleKey[] {
  if (role === "ADMIN") {
    return roles.includes("ADMIN") ? [] : ["ADMIN"];
  }
  const next = roles.includes(role)
    ? roles.filter((value) => value !== role)
    : [...roles, role];
  return normalizeRoleKeys(next);
}

/** Editable state for the admin user edit panel. */
export interface UserEditState {
  firstName: string;
  lastName: string;
  roles: RoleKey[];
  active: boolean;
}

/** Map a known API failure to a specific, safe Lithuanian message. */
export function userAdminErrorMessage(error: ApiError): string {
  switch (error.status) {
    case 400:
      return "Neteisingi duomenys. Patikrinkite laukus.";
    case 403:
      return "Neturite teisės atnaujinti naudotojų.";
    case 404:
      return "Naudotojas nerastas.";
    case 409:
      // Business-rule conflicts carry a specific Lithuanian message.
      return error.message || "Veiksmo atlikti negalima.";
    default:
      return error.status >= 500
        ? "Serverio klaida. Bandykite vėliau."
        : "Nepavyko atnaujinti naudotojo.";
  }
}

/** Replace a single user row in the list, preserving order. */
export function applyUserUpdate(
  users: UserSummary[],
  updated: UserSummary,
): UserSummary[] {
  return users.map((user) => (user.id === updated.id ? updated : user));
}

/**
 * Post-save UI state: replace the row, close the edit panel and clear any stale
 * error so the table stays consistent without a manual reload.
 */
export function userEditSuccess(
  users: UserSummary[],
  updated: UserSummary,
): {
  users: UserSummary[];
  editingId: null;
  edit: null;
  error: null;
} {
  return {
    users: applyUserUpdate(users, updated),
    editingId: null,
    edit: null,
    error: null,
  };
}
