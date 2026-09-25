import { describe, expect, it } from "vitest";
import { isNavItemActive, visibleNavItems } from "./navigation";

describe("visibleNavItems", () => {
  it("shows Pradžia to every authenticated user", () => {
    for (const roles of [[], ["WAREHOUSE_WORKER"], ["ACCOUNTING"]] as const) {
      const labels = visibleNavItems([...roles]).map((item) => item.label);
      expect(labels).toContain("Pradžia");
    }
  });

  it("shows Partneriai to every authenticated user", () => {
    for (const roles of [[], ["WAREHOUSE_WORKER"], ["ACCOUNTING"]] as const) {
      expect(
        visibleNavItems([...roles]).map((item) => item.label),
      ).toContain("Partneriai");
    }
  });

  it("shows Ištekliai to every authenticated user", () => {
    for (const roles of [[], ["WAREHOUSE_WORKER"], ["ACCOUNTING"]] as const) {
      expect(
        visibleNavItems([...roles]).map((item) => item.label),
      ).toContain("Ištekliai");
    }
  });

  it("shows Pajamavimas to every authenticated user", () => {
    for (const roles of [[], ["WAREHOUSE_WORKER"], ["ACCOUNTING"]] as const) {
      expect(
        visibleNavItems([...roles]).map((item) => item.label),
      ).toContain("Pajamavimas");
    }
  });

  it("shows Sandėliai to every authenticated user", () => {
    for (const roles of [[], ["WAREHOUSE_WORKER"], ["ACCOUNTING"]] as const) {
      expect(
        visibleNavItems([...roles]).map((item) => item.label),
      ).toContain("Sandėliai");
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
      "/partners",
      "/resources",
      "/warehouses",
      "/receipts",
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

  it("marks Partneriai active on the partners list and nested routes", () => {
    expect(isNavItemActive("/partners", "/partners")).toBe(true);
    expect(isNavItemActive("/partners", "/partners/new")).toBe(true);
    expect(
      isNavItemActive(
        "/partners",
        "/partners/0f1f2f3f-0000-4000-8000-000000000000",
      ),
    ).toBe(true);
    expect(isNavItemActive("/partners", "/")).toBe(false);
    expect(isNavItemActive("/partners", "/admin/users")).toBe(false);
  });

  it("marks Ištekliai active on the resources list and nested routes", () => {
    expect(isNavItemActive("/resources", "/resources")).toBe(true);
    expect(isNavItemActive("/resources", "/resources/new")).toBe(true);
    expect(
      isNavItemActive(
        "/resources",
        "/resources/0f1f2f3f-0000-4000-8000-000000000000",
      ),
    ).toBe(true);
    expect(isNavItemActive("/resources", "/resources/packing-forms")).toBe(true);
    expect(isNavItemActive("/resources", "/partners")).toBe(false);
  });

  it("marks Pajamavimas active on the receipts routes", () => {
    expect(isNavItemActive("/receipts", "/receipts")).toBe(true);
    expect(isNavItemActive("/receipts", "/receipts/new")).toBe(true);
    expect(
      isNavItemActive(
        "/receipts",
        "/receipts/0f1f2f3f-0000-4000-8000-000000000000",
      ),
    ).toBe(true);
    expect(isNavItemActive("/receipts", "/resources")).toBe(false);
  });

  it("marks Sandėliai active on the warehouse routes", () => {
    expect(isNavItemActive("/warehouses", "/warehouses")).toBe(true);
    expect(
      isNavItemActive(
        "/warehouses",
        "/warehouses/0f1f2f3f-0000-4000-8000-000000000000",
      ),
    ).toBe(true);
    expect(isNavItemActive("/warehouses", "/receipts")).toBe(false);
  });
});
