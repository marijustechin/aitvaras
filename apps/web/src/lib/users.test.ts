import { describe, expect, it } from "vitest";
import type { UserSummary } from "@aitvaras/contracts";
import { ApiError } from "./api";
import {
  activeToggleLabel,
  applyUserUpdate,
  isRoleControlDisabled,
  toggleRoleSelection,
  userAdminErrorMessage,
  userEditSuccess,
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

describe("applyUserUpdate / userEditSuccess", () => {
  it("replaces only the matching row and preserves order", () => {
    const list = [user("a", "A"), user("b", "B")];
    const updated = user("a", "Changed");
    const next = applyUserUpdate(list, updated);
    expect(next.map((item) => item.firstName)).toEqual(["Changed", "B"]);
    expect(next).toHaveLength(2);
  });

  it("clears the edit session and stale error after a successful save", () => {
    const list = [user("a", "A")];
    const result = userEditSuccess(list, user("a", "Saved"));
    expect(result.error).toBeNull();
    expect(result.editingId).toBeNull();
    expect(result.edit).toBeNull();
    expect(result.users[0]?.firstName).toBe("Saved");
  });
});
