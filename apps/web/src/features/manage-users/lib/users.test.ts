import { describe, expect, it } from "vitest";
import type { UserSummary } from "@aitvaras/contracts";
import { ApiError } from "@/shared/api";
import {
  activeToggleLabel,
  applyUserUpdate,
  CLOSED_PASSWORD_RESET_PANEL,
  closePasswordResetPanel,
  emptyPasswordReset,
  isRoleControlDisabled,
  MIN_PASSWORD_LENGTH,
  openPasswordResetPanel,
  PASSWORD_RESET_MESSAGES,
  passwordResetError,
  passwordResetErrorMessage,
  passwordResetPayload,
  passwordTooShortMessage,
  toggleRoleSelection,
  userAdminErrorMessage,
  userEditPayload,
} from "./users";

describe("activeToggleLabel", () => {
  it("shows Išjungti for active users and Įjungti for inactive users", () => {
    expect(activeToggleLabel(true)).toBe("Išjungti");
    expect(activeToggleLabel(false)).toBe("Įjungti");
  });
});

describe("toggleRoleSelection", () => {
  it("clears other roles when ADMIN is selected", () => {
    expect(toggleRoleSelection(["ACCOUNTING"], "ADMIN")).toEqual(["ADMIN"]);
    expect(
      toggleRoleSelection(["ACCOUNTING", "WAREHOUSE_WORKER"], "ADMIN"),
    ).toEqual(["ADMIN"]);
  });

  it("re-enables other roles without restoring them when ADMIN is cleared", () => {
    expect(toggleRoleSelection(["ADMIN"], "ADMIN")).toEqual([]);
    expect(toggleRoleSelection([], "ACCOUNTING")).toEqual(["ACCOUNTING"]);
  });

  it("keeps ADMIN dominant if another role is somehow toggled", () => {
    expect(toggleRoleSelection(["ADMIN"], "WAREHOUSE_WORKER")).toEqual(["ADMIN"]);
  });

  it("toggles non-admin roles normally", () => {
    expect(toggleRoleSelection([], "WAREHOUSE_WORKER")).toEqual([
      "WAREHOUSE_WORKER",
    ]);
    expect(
      toggleRoleSelection(["WAREHOUSE_WORKER", "ACCOUNTING"], "ACCOUNTING"),
    ).toEqual(["WAREHOUSE_WORKER"]);
  });
});

describe("isRoleControlDisabled", () => {
  it("disables other roles while ADMIN is selected", () => {
    expect(isRoleControlDisabled("ACCOUNTING", ["ADMIN"])).toBe(true);
    expect(isRoleControlDisabled("ADMIN", ["ADMIN"])).toBe(false);
  });

  it("disables nothing when ADMIN is not selected", () => {
    expect(isRoleControlDisabled("ACCOUNTING", ["WAREHOUSE_WORKER"])).toBe(
      false,
    );
    expect(isRoleControlDisabled("ACCOUNTING", [])).toBe(false);
  });
});

describe("userAdminErrorMessage", () => {
  it("maps authorization, validation, not-found and server failures", () => {
    expect(userAdminErrorMessage(new ApiError(403, "Forbidden"))).toBe(
      "Neturite teisės atnaujinti naudotojų.",
    );
    expect(userAdminErrorMessage(new ApiError(400, "Validation failed"))).toBe(
      "Neteisingi duomenys. Patikrinkite laukus.",
    );
    expect(userAdminErrorMessage(new ApiError(404, "User not found"))).toBe(
      "Naudotojas nerastas.",
    );
    expect(userAdminErrorMessage(new ApiError(500, "boom"))).toBe(
      "Serverio klaida. Bandykite vėliau.",
    );
  });

  it("passes through the specific business-rule conflict message", () => {
    expect(
      userAdminErrorMessage(
        new ApiError(
          409,
          "Negalima išjungti paskutinio aktyvaus administratoriaus.",
        ),
      ),
    ).toBe("Negalima išjungti paskutinio aktyvaus administratoriaus.");
  });
});

function user(id: string, firstName: string): UserSummary {
  return {
    id,
    username: id,
    firstName,
    lastName: "Person",
    roles: ["ACCOUNTING"],
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("applyUserUpdate", () => {
  it("replaces only the matching row and preserves order", () => {
    const list = [user("a", "A"), user("b", "B")];
    const updated = user("a", "Changed");
    const next = applyUserUpdate(list, updated);
    expect(next.map((item) => item.firstName)).toEqual(["Changed", "B"]);
    expect(next).toHaveLength(2);
  });
});

describe("administrator password reset helpers", () => {
  it("starts with empty password inputs", () => {
    expect(emptyPasswordReset()).toEqual({ password: "", confirm: "" });
  });

  it("requires the shared minimum length (6) with an actionable message", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(6);
    expect(passwordTooShortMessage()).toBe(
      "Slaptažodis turi būti bent 6 simbolių.",
    );
    expect(
      passwordResetError({ password: "abcde", confirm: "abcde" }),
    ).toBe(passwordTooShortMessage());
    expect(
      passwordResetError({ password: "abcdef", confirm: "abcdef" }),
    ).toBeNull();
  });

  it("requires both fields", () => {
    expect(passwordResetError({ password: "", confirm: "" })).toBe(
      PASSWORD_RESET_MESSAGES.required,
    );
    expect(passwordResetError({ password: "abcdef", confirm: "" })).toBe(
      PASSWORD_RESET_MESSAGES.confirmRequired,
    );
  });

  it("requires the confirmation to match", () => {
    expect(
      passwordResetError({ password: "abcdef", confirm: "abcdeg" }),
    ).toBe(PASSWORD_RESET_MESSAGES.mismatch);
  });

  it("builds a payload containing only the new password", () => {
    expect(
      passwordResetPayload({ password: "new-password-123", confirm: "ignored" }),
    ).toEqual({ password: "new-password-123" });
    expect(
      Object.keys(passwordResetPayload(emptyPasswordReset())),
    ).toEqual(["password"]);
  });
});

describe("password reset panel state", () => {
  it("starts closed with empty fields", () => {
    expect(CLOSED_PASSWORD_RESET_PANEL).toEqual({
      open: false,
      form: { password: "", confirm: "" },
    });
  });

  it("opens with empty fields", () => {
    expect(openPasswordResetPanel()).toEqual({
      open: true,
      form: { password: "", confirm: "" },
    });
  });

  it("Uždaryti closes and clears both fields", () => {
    expect(closePasswordResetPanel()).toEqual({
      open: false,
      form: { password: "", confirm: "" },
    });
  });

  it("does not carry any user-edit fields (the edit form is untouched)", () => {
    const panel = closePasswordResetPanel();
    expect(Object.keys(panel).sort()).toEqual(["form", "open"]);
    const serialized = JSON.stringify(panel);
    expect(serialized).not.toContain("firstName");
    expect(serialized).not.toContain("roles");
    expect(serialized).not.toContain("active");
  });
});

describe("passwordResetErrorMessage", () => {
  it("maps a server validation error to the actionable length message", () => {
    expect(
      passwordResetErrorMessage(
        new ApiError(400, "Validation failed", "VALIDATION_ERROR"),
      ),
    ).toBe(passwordTooShortMessage());
  });

  it("maps authorization and not-found responses", () => {
    expect(passwordResetErrorMessage(new ApiError(403, "Forbidden"))).toBe(
      PASSWORD_RESET_MESSAGES.forbidden,
    );
    expect(passwordResetErrorMessage(new ApiError(404, "Not found"))).toBe(
      PASSWORD_RESET_MESSAGES.notFound,
    );
  });

  it("uses a clear retry message for unexpected failures", () => {
    expect(passwordResetErrorMessage(new ApiError(500, "boom"))).toBe(
      PASSWORD_RESET_MESSAGES.failed,
    );
    expect(passwordResetErrorMessage(new Error("network"))).toBe(
      PASSWORD_RESET_MESSAGES.failed,
    );
    // A 400 without the explicit validation code is not treated as "too short".
    expect(passwordResetErrorMessage(new ApiError(400, "Bad request"))).toBe(
      PASSWORD_RESET_MESSAGES.failed,
    );
  });
});

describe("userEditPayload", () => {
  it("never includes a password in the generic user update", () => {
    const payload = userEditPayload({
      firstName: "Jonas",
      lastName: "Jonaitis",
      roles: ["ACCOUNTING"],
      active: true,
    });
    expect(Object.keys(payload).sort()).toEqual([
      "active",
      "firstName",
      "lastName",
      "roles",
    ]);
    expect(JSON.stringify(payload)).not.toContain("password");
  });
});
