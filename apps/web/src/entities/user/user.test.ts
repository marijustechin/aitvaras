import { describe, expect, it } from "vitest";
import { userRolesSummary } from "./user";

describe("userRolesSummary", () => {
  it("maps system access roles to Lithuanian labels", () => {
    expect(userRolesSummary(["ADMIN"])).toBe("Administratorius");
    expect(userRolesSummary(["WAREHOUSE_WORKER", "ACCOUNTING"])).toBe(
      "Sandėlio darbuotojas, Apskaita",
    );
  });

  it("renders an empty summary for no roles", () => {
    expect(userRolesSummary([])).toBe("");
  });
});
