import {
  normalizeRoleKeys,
  type RoleKey,
  type UserSummary,
} from "@aitvaras/contracts";
import { ApiError } from "@/shared/api";

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

/**
 * Request body for the generic user update (`PATCH /users/:id`).
 *
 * Deliberately contains no password: passwords are changed through the separate
 * administrator reset action.
 */
export function userEditPayload(edit: UserEditState): UserEditState {
  return {
    firstName: edit.firstName,
    lastName: edit.lastName,
    roles: edit.roles,
    active: edit.active,
  };
}

/** Minimum password length, matching the shared contract (`PasswordSchema`). */
export const MIN_PASSWORD_LENGTH = 6;

/** State of the inline administrator password-reset form. */
export interface PasswordResetState {
  password: string;
  confirm: string;
}

/** Empty reset form (also used to clear all inputs after success/cancel). */
export function emptyPasswordReset(): PasswordResetState {
  return { password: "", confirm: "" };
}

/** Success message shown after a password reset. */
export const PASSWORD_RESET_SUCCESS = "Slaptažodis pakeistas.";

/**
 * Consolidated state of the inline administrator password-reset section.
 *
 * Deliberately contains no user-edit fields: closing the section clears only the
 * password form and its messages, so the surrounding user-edit form is untouched.
 */
export interface PasswordResetPanelState {
  open: boolean;
  form: PasswordResetState;
  error: string | null;
  success: string | null;
}

/** Initial/closed panel: no fields entered, no messages. */
export const CLOSED_PASSWORD_RESET_PANEL: PasswordResetPanelState = {
  open: false,
  form: emptyPasswordReset(),
  error: null,
  success: null,
};

/** Open the reset section with empty fields and no messages. */
export function openPasswordResetPanel(): PasswordResetPanelState {
  return {
    open: true,
    form: emptyPasswordReset(),
    error: null,
    success: null,
  };
}

/**
 * Close the reset section (`Uždaryti`): clear both password fields and every
 * reset message. The normal user-edit form is not part of this state.
 */
export function closePasswordResetPanel(): PasswordResetPanelState {
  return {
    open: false,
    form: emptyPasswordReset(),
    error: null,
    success: null,
  };
}

/** Successful reset: close the section, clear the fields, show the success note. */
export function passwordResetPanelSuccess(): PasswordResetPanelState {
  return {
    open: false,
    form: emptyPasswordReset(),
    error: null,
    success: PASSWORD_RESET_SUCCESS,
  };
}

/** Field-level and failure messages for the reset form. */
export const PASSWORD_RESET_MESSAGES = {
  required: "Įveskite slaptažodį.",
  confirmRequired: "Pakartokite slaptažodį.",
  mismatch: "Slaptažodžiai nesutampa.",
  notFound: "Naudotojas nerastas.",
  forbidden: "Neturite teisės keisti slaptažodžio.",
  failed: "Nepavyko pakeisti slaptažodžio. Bandykite dar kartą.",
} as const;

/** Actionable "too short" message for the shared minimum length. */
export function passwordTooShortMessage(): string {
  return `Slaptažodis turi būti bent ${MIN_PASSWORD_LENGTH} simbolių.`;
}

/**
 * Client-side validation for the reset form. Returns an actionable Lithuanian
 * message, or `null` when the form may be submitted. The server re-validates.
 */
export function passwordResetError(state: PasswordResetState): string | null {
  if (state.password.length === 0) {
    return PASSWORD_RESET_MESSAGES.required;
  }
  if (state.confirm.length === 0) {
    return PASSWORD_RESET_MESSAGES.confirmRequired;
  }
  if (state.password.length < MIN_PASSWORD_LENGTH) {
    return passwordTooShortMessage();
  }
  if (state.password !== state.confirm) {
    return PASSWORD_RESET_MESSAGES.mismatch;
  }
  return null;
}

/**
 * Map a failed reset request to a specific, actionable message.
 *
 * The endpoint's only server-side field validation is the password length, so a
 * `VALIDATION_ERROR` maps to the "too short" message instead of the generic
 * "invalid data" text. Raw validation dumps are never surfaced to the user;
 * truly unexpected failures use a single clear retry message.
 */
export function passwordResetErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 400 && error.code === "VALIDATION_ERROR") {
      return passwordTooShortMessage();
    }
    if (error.status === 403) {
      return PASSWORD_RESET_MESSAGES.forbidden;
    }
    if (error.status === 404) {
      return PASSWORD_RESET_MESSAGES.notFound;
    }
  }
  return PASSWORD_RESET_MESSAGES.failed;
}

/**
 * Request body for `PATCH /users/:id/password`. The old password is never sent.
 */
export function passwordResetPayload(state: PasswordResetState): {
  password: string;
} {
  return { password: state.password };
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
