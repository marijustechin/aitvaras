import { describe, expect, it } from "vitest";
import { isNavItemActive, visibleNavItems } from "./navigation";

describe("visibleNavItems", () => {
  it("shows Pradžia to every authenticated user", () => {
    for (const roles of [[], ["WAREHOUSE_WORKER"], ["ACCOUNTING"]] as const) {
      const labels = visibleNavItems([...roles]).map((item) => item.label);
      expect(labels).toContain("Pradžia");
    }
  });

  it("shows Naudotojai only to ADMIN", () => {
    expect(
      visibleNavItems(["ADMIN"]).map((item) => item.label),
    ).toContain("Naudotojai");
    expect(
      visibleNavItems(["WAREHOUSE_WORKER"]).map((item) => item.label),
    ).not.toContain("Naudotojai");
    expect(visibleNavItems([]).map((item) => item.label)).not.toContain(
      "Naudotojai",
    );
  });

  it("contains no unconfirmed navigation items", () => {
    expect(visibleNavItems(["ADMIN"]).map((item) => item.href)).toEqual([
      "/",
      "/admin/users",
    ]);
  });
});

describe("isNavItemActive", () => {
  it("marks Pradžia active only on the home path", () => {
    expect(isNavItemActive("/", "/")).toBe(true);
    expect(isNavItemActive("/", "/profile")).toBe(false);
    expect(isNavItemActive("/", "/admin/users")).toBe(false);
  });

  it("marks Naudotojai active on nested admin routes", () => {
    expect(isNavItemActive("/admin/users", "/admin/users")).toBe(true);
    expect(isNavItemActive("/admin/users", "/admin/users/123")).toBe(true);
    expect(isNavItemActive("/admin/users", "/profile")).toBe(false);
  });
});
