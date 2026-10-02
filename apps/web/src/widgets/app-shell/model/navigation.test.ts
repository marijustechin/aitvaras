import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  EMPTY_GROUP_LABEL,
  isNavGroupActive,
  isNavItemActive,
  NAV_GROUP_LABELS,
  visibleNavEntries,
  type VisibleNavEntry,
  type VisibleNavGroup,
} from "./navigation";

function topLevelLinks(entries: VisibleNavEntry[]) {
  return entries.filter((entry) => entry.kind === "link");
}

function groupOf(entries: VisibleNavEntry[], id: string): VisibleNavGroup {
  const found = entries.find(
    (entry): entry is VisibleNavGroup =>
      entry.kind === "group" && entry.id === id,
  );
  if (!found) {
    throw new Error(`expected navigation group "${id}"`);
  }
  return found;
}

function allHrefs(entries: VisibleNavEntry[]): string[] {
  return entries.flatMap((entry) =>
    entry.kind === "link" ? [entry.href] : entry.children.map((c) => c.href),
  );
}

describe("visibleNavEntries — information architecture", () => {
  const admin = visibleNavEntries(["ADMIN"]);

  it("keeps operational workflows top-level", () => {
    const links = topLevelLinks(admin).map((link) => link.label);
    expect(links).toContain("Pradžia");
    expect(links).toContain("Registruoti sandėlyje");
    expect(links).toContain("Gavimai");
  });

  it("groups reference data under Žinynai", () => {
    const { label, children } = groupOf(admin, "directories");
    expect(label).toBe(NAV_GROUP_LABELS.directories);
    expect(label).toBe("Žinynai");
    expect(children.map((child) => child.label)).toEqual([
      "Partneriai",
      "Ištekliai",
      "Sandėliai",
    ]);
    expect(children.map((child) => child.href)).toEqual([
      "/partners",
      "/resources",
      "/warehouses",
    ]);
  });

  it("groups users under Sistema", () => {
    const { label, children } = groupOf(admin, "system");
    expect(label).toBe("Sistema");
    expect(children).toEqual([
      { kind: "link", href: "/admin/users", label: "Naudotojai" },
    ]);
  });

  it("groups the discrepancy register under Ataskaitos", () => {
    const { label, children } = groupOf(admin, "reports");
    expect(label).toBe("Ataskaitos");
    expect(children).toEqual([
      {
        kind: "link",
        href: "/reports/discrepancies",
        label: "Neatitikimai",
      },
    ]);
  });

  it("keeps the reserved-empty-group label available", () => {
    expect(EMPTY_GROUP_LABEL).toBe("Ruošiama");
  });

  it("does not leave stale flat duplicates at the top level", () => {
    const links = topLevelLinks(admin).map((link) => link.label);
    for (const label of ["Partneriai", "Ištekliai", "Sandėliai", "Naudotojai"]) {
      expect(links).not.toContain(label);
    }
  });

  it("preserves every existing route (nothing added or renamed)", () => {
    expect(new Set(allHrefs(admin))).toEqual(
      new Set([
        "/",
        "/receiving",
        "/receipts",
        "/partners",
        "/resources",
        "/warehouses",
        "/reports/discrepancies",
        "/admin/users",
      ]),
    );
  });
});

describe("visibleNavEntries — role visibility", () => {
  it("gives ADMIN the full grouped navigation", () => {
    const groups = visibleNavEntries(["ADMIN"])
      .filter((entry) => entry.kind === "group")
      .map((entry) => entry.id);
    expect(groups).toEqual(["directories", "reports", "system"]);
  });

  it("keeps the warehouse worker operational only", () => {
    const entries = visibleNavEntries(["WAREHOUSE_WORKER"]);
    expect(topLevelLinks(entries).map((link) => link.label)).toEqual([
      "Pradžia",
      "Registruoti sandėlyje",
    ]);
    expect(
      entries
        .filter((entry) => entry.kind === "group")
        .map((entry) => entry.id),
    ).toEqual(["directories"]);
    // Reference data stays reachable; administrative items do not.
    expect(allHrefs(entries)).toContain("/partners");
    expect(allHrefs(entries)).not.toContain("/receipts");
    expect(allHrefs(entries)).not.toContain("/admin/users");
  });

  it("shows Gavimai to administrative roles but not the worker", () => {
    for (const roles of [["ACCOUNTING"], ["ADMIN"]] as const) {
      expect(allHrefs(visibleNavEntries([...roles]))).toContain("/receipts");
    }
    expect(
      allHrefs(visibleNavEntries(["WAREHOUSE_WORKER"])),
    ).not.toContain("/receipts");
  });

  it("shows the Neatitikimai register only to ADMIN", () => {
    expect(allHrefs(visibleNavEntries(["ADMIN"]))).toContain(
      "/reports/discrepancies",
    );
    for (const roles of [["ACCOUNTING"], ["WAREHOUSE_WORKER"], []] as const) {
      expect(allHrefs(visibleNavEntries([...roles]))).not.toContain(
        "/reports/discrepancies",
      );
    }
    // Ataskaitos has no in-scope children for a non-admin, so the group hides.
    expect(
      visibleNavEntries(["ACCOUNTING"])
        .filter((entry) => entry.kind === "group")
        .map((entry) => entry.id),
    ).not.toContain("reports");
  });

  it("hides Sistema from everyone except ADMIN", () => {
    const groupIds = (roles: Parameters<typeof visibleNavEntries>[0]) =>
      visibleNavEntries(roles)
        .filter((entry) => entry.kind === "group")
        .map((entry) => entry.id);
    expect(groupIds(["ADMIN"])).toContain("system");
    expect(groupIds(["ACCOUNTING"])).not.toContain("system");
    expect(groupIds(["WAREHOUSE_WORKER"])).not.toContain("system");
    expect(groupIds([])).not.toContain("system");
  });

  it("shows Naudotojai only to ADMIN through the Sistema group", () => {
    expect(allHrefs(visibleNavEntries(["ADMIN"]))).toContain("/admin/users");
    expect(allHrefs(visibleNavEntries(["WAREHOUSE_WORKER"]))).not.toContain(
      "/admin/users",
    );
    expect(allHrefs(visibleNavEntries([]))).not.toContain("/admin/users");
  });
});

describe("isNavGroupActive", () => {
  const admin = visibleNavEntries(["ADMIN"]);
  const directories = groupOf(admin, "directories");
  const system = groupOf(admin, "system");

  it("activates the parent when one of its children is active", () => {
    expect(isNavGroupActive(directories, "/partners")).toBe(true);
    expect(isNavGroupActive(directories, "/partners/new")).toBe(true);
    expect(isNavGroupActive(directories, "/resources/123")).toBe(true);
    expect(isNavGroupActive(directories, "/warehouses/abc")).toBe(true);
    expect(isNavGroupActive(directories, "/")).toBe(false);
    expect(isNavGroupActive(directories, "/receipts")).toBe(false);
  });

  it("activates Sistema on admin routes", () => {
    expect(isNavGroupActive(system, "/admin/users")).toBe(true);
    expect(isNavGroupActive(system, "/admin/users/123")).toBe(true);
    expect(isNavGroupActive(system, "/partners")).toBe(false);
  });

  it("activates Ataskaitos on the discrepancy register routes", () => {
    const reports = groupOf(admin, "reports");
    expect(isNavGroupActive(reports, "/reports/discrepancies")).toBe(true);
    expect(
      isNavGroupActive(
        reports,
        "/reports/discrepancies/0f1f2f3f-0000-4000-8000-000000000000",
      ),
    ).toBe(true);
    expect(isNavGroupActive(reports, "/")).toBe(false);
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

  it("marks child links active on their list and nested routes", () => {
    expect(isNavItemActive("/resources", "/resources/packaging-types")).toBe(true);
    expect(
      isNavItemActive(
        "/warehouses",
        "/warehouses/0f1f2f3f-0000-4000-8000-000000000000",
      ),
    ).toBe(true);
    expect(isNavItemActive("/partners", "/partners/new")).toBe(true);
    expect(isNavItemActive("/partners", "/admin/users")).toBe(false);
  });

  it("marks Gavimai active on the receipts routes", () => {
    expect(isNavItemActive("/receipts", "/receipts")).toBe(true);
    expect(isNavItemActive("/receipts", "/receipts/new")).toBe(true);
    expect(isNavItemActive("/receipts", "/resources")).toBe(false);
  });
});

describe("MainNavigation (source)", () => {
  const source = readFileSync(
    fileURLToPath(new URL("../ui/main-navigation.tsx", import.meta.url)),
    "utf8",
  );

  it("renders grouped dropdowns with accessible triggers", () => {
    expect(source).toContain('aria-haspopup="menu"');
    expect(source).toContain("aria-expanded");
    expect(source).toContain('role="menu"');
    expect(source).toContain("isNavGroupActive");
    expect(source).toContain("EMPTY_GROUP_LABEL");
    expect(source).toContain('event.key === "Escape"');
  });

  it("provides a responsive menu instead of desktop-only navigation", () => {
    expect(source).toContain("md:flex");
    expect(source).toContain("md:hidden");
    expect(source).toContain("mobile-navigation");
    expect(source).toContain("Meniu");
  });

  it("does not reload the page or duplicate the flat links", () => {
    expect(source).not.toContain("window.location");
    expect(source).not.toContain("Partneriai");
    expect(source).not.toContain("Naudotojai");
  });
});
