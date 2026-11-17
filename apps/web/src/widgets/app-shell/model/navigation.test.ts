import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  activeChild,
  activeDestination,
  isDestinationActive,
  isPathWithin,
  NAV_SECTIONS,
  visibleNavSections,
  type VisibleNavDestination,
  type VisibleNavSection,
} from "./navigation";

function allHrefs(sections: readonly VisibleNavSection[]): string[] {
  return sections.flatMap((section) =>
    section.items.flatMap((item) => [
      item.href,
      ...item.activeHrefs,
      ...item.children.map((child) => child.href),
    ]),
  );
}

function destinationOf(
  sections: readonly VisibleNavSection[],
  id: string,
): VisibleNavDestination {
  for (const section of sections) {
    const found = section.items.find((item) => item.id === id);
    if (found) {
      return found;
    }
  }
  throw new Error(`expected navigation destination "${id}"`);
}

describe("navigation — information architecture", () => {
  const admin = visibleNavSections(["ADMIN"]);

  it("uses labelled sidebar sections", () => {
    expect(admin.map((section) => section.label)).toEqual([
      "Operacijos",
      "Duomenys",
      "Administravimas",
    ]);
  });

  it("keeps operational workflows as plain sidebar links", () => {
    const operations = admin.find((section) => section.id === "operations");
    expect(
      operations?.items.map((item) => [item.label, item.children.length]),
    ).toEqual([
      ["Suvestinė", 0],
      ["Priėmimas", 0],
    ]);
  });

  it("groups every reference-data section under Žinynai", () => {
    const directories = destinationOf(admin, "directories");
    expect(directories.label).toBe("Žinynai");
    expect(directories.href).toBe("/partners");
    expect(directories.children).toEqual([
      { href: "/partners", label: "Partneriai" },
      { href: "/resources", label: "Ištekliai" },
      { href: "/resources/categories", label: "Kategorijos" },
      { href: "/resources/packaging-types", label: "Tara" },
      { href: "/warehouses", label: "Sandėliai" },
    ]);
  });

  it("groups the discrepancy register under Ataskaitos", () => {
    const reports = destinationOf(admin, "reports");
    expect(reports.label).toBe("Ataskaitos");
    expect(reports.children).toEqual([
      { href: "/reports/discrepancies", label: "Neatitikimai" },
    ]);
  });

  it("groups company settings and users under Nustatymai", () => {
    const settings = destinationOf(admin, "settings");
    expect(settings.label).toBe("Nustatymai");
    expect(settings.href).toBe("/settings/company");
    expect(settings.children).toEqual([
      { href: "/settings/company", label: "Įmonė" },
      { href: "/admin/users", label: "Naudotojai" },
    ]);
  });

  it("declares every implemented route", () => {
    expect(new Set(allHrefs(admin))).toEqual(
      new Set([
        "/",
        "/receiving",
        "/receipts",
        "/partners",
        "/resources",
        "/resources/categories",
        "/resources/packaging-types",
        "/warehouses",
        "/reports/discrepancies",
        "/admin/users",
        "/settings/company",
      ]),
    );
  });

  it("declares destinations unique by id", () => {
    const ids = NAV_SECTIONS.flatMap((section) =>
      section.items.map((item) => item.id),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("navigation — role visibility", () => {
  it("keeps the warehouse receiving destination plus reference data", () => {
    const sections = visibleNavSections(["WAREHOUSE_WORKER"]);
    expect(sections.map((section) => section.label)).toEqual([
      "Operacijos",
      "Duomenys",
    ]);
    const operations = sections.find((section) => section.id === "operations");
    expect(operations?.items.map((item) => item.label)).toEqual([
      "Suvestinė",
      "Priėmimas",
    ]);
    const hrefs = allHrefs(sections);
    expect(hrefs).toContain("/partners");
    expect(hrefs).toContain("/receipts");
    expect(hrefs).toContain("/receiving");
    expect(hrefs).not.toContain("/reports/discrepancies");
    expect(hrefs).not.toContain("/admin/users");
  });

  it("shows Priėmimas to every authenticated role", () => {
    for (const roles of [["ACCOUNTING"], ["ADMIN"], ["WAREHOUSE_WORKER"]] as const) {
      expect(allHrefs(visibleNavSections([...roles]))).toContain("/receipts");
    }
  });

  it("shows the Neatitikimai register only to ADMIN", () => {
    expect(allHrefs(visibleNavSections(["ADMIN"]))).toContain(
      "/reports/discrepancies",
    );
    for (const roles of [["ACCOUNTING"], ["WAREHOUSE_WORKER"], []] as const) {
      expect(allHrefs(visibleNavSections([...roles]))).not.toContain(
        "/reports/discrepancies",
      );
    }
    // Ataskaitos has no in-scope children for a non-admin, so it hides.
    expect(
      visibleNavSections(["ACCOUNTING"]).map((section) => section.id),
    ).not.toContain("administration");
  });

  it("hides Nustatymai from everyone except ADMIN", () => {
    const labels = (roles: Parameters<typeof visibleNavSections>[0]) =>
      visibleNavSections(roles).flatMap((section) =>
        section.items.map((item) => item.label),
      );
    expect(labels(["ADMIN"])).toContain("Nustatymai");
    expect(labels(["ACCOUNTING"])).not.toContain("Nustatymai");
    expect(labels(["WAREHOUSE_WORKER"])).not.toContain("Nustatymai");
    expect(labels([])).not.toContain("Nustatymai");
  });
});

describe("active destination and child", () => {
  const admin = visibleNavSections(["ADMIN"]);

  it("matches an exact route or a parent route", () => {
    expect(isPathWithin("/", "/")).toBe(true);
    expect(isPathWithin("/", "/profile")).toBe(false);
    expect(isPathWithin("/partners", "/partners")).toBe(true);
    expect(isPathWithin("/partners", "/partners/new")).toBe(true);
    expect(isPathWithin("/partners", "/partners-other")).toBe(false);
  });

  it("activates Suvestinė only on the home path", () => {
    const active = activeDestination(admin, "/");
    expect(active?.destination.id).toBe("home");
    expect(active?.child).toBeNull();
  });

  it("activates Priėmimas across list, creation and detail routes", () => {
    for (const pathname of [
      "/receipts",
      "/receipts/batches/0f1f2f3f-0000-4000-8000-000000000000",
      "/receiving",
      "/receiving/new",
      "/receiving/0f1f2f3f-0000-4000-8000-000000000000",
      "/receiving/0f1f2f3f-0000-4000-8000-000000000000/batches/1",
    ]) {
      const active = activeDestination(admin, pathname);
      expect(active?.destination.id).toBe("receipts");
      expect(active?.destination.label).toBe("Priėmimas");
      expect(active?.child).toBeNull();
    }
  });

  it("activates Žinynai on every reference-data route", () => {
    for (const pathname of [
      "/partners",
      "/partners/new",
      "/resources",
      "/resources/new",
      "/resources/categories",
      "/resources/packaging-types",
      "/warehouses",
      "/warehouses/0f1f2f3f-0000-4000-8000-000000000000",
    ]) {
      expect(activeDestination(admin, pathname)?.destination.id).toBe(
        "directories",
      );
    }
  });

  it("selects exactly one most-specific child", () => {
    const directories = destinationOf(admin, "directories");
    expect(activeChild(directories, "/partners/new")?.label).toBe("Partneriai");
    expect(activeChild(directories, "/resources")?.label).toBe("Ištekliai");
    expect(activeChild(directories, "/resources/new")?.label).toBe("Ištekliai");
    expect(activeChild(directories, "/resources/categories")?.label).toBe(
      "Kategorijos",
    );
    expect(activeChild(directories, "/resources/packaging-types")?.label).toBe(
      "Tara",
    );
    expect(activeChild(directories, "/warehouses/abc")?.label).toBe("Sandėliai");
  });

  it("activates Nustatymai and Ataskaitos on their routes", () => {
    const settings = destinationOf(admin, "settings");
    expect(isDestinationActive(settings, "/admin/users")).toBe(true);
    expect(isDestinationActive(settings, "/admin/users/123")).toBe(true);
    expect(isDestinationActive(settings, "/settings/company")).toBe(true);
    expect(isDestinationActive(settings, "/partners")).toBe(false);

    const reports = destinationOf(admin, "reports");
    expect(isDestinationActive(reports, "/reports/discrepancies")).toBe(true);
    expect(
      activeDestination(
        admin,
        "/reports/discrepancies/0f1f2f3f-0000-4000-8000-000000000000",
      )?.child?.label,
    ).toBe("Neatitikimai");
  });

  it("does not claim self-service profile routes", () => {
    expect(activeDestination(admin, "/profile")).toBeNull();
  });
});

describe("shell source — sidebar, child navigation and drawer", () => {
  const read = (path: string) =>
    readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

  it("removes the previous horizontal main navigation", () => {
    expect(
      existsSync(
        fileURLToPath(new URL("../ui/main-navigation.tsx", import.meta.url)),
      ),
    ).toBe(false);
  });

  it("renders role-filtered destinations in a dark sidebar with active state", () => {
    const source = read("../ui/app-sidebar.tsx");
    expect(source).toContain('aria-label="Pagrindinė navigacija"');
    expect(source).toContain("aria-current");
    expect(source).toContain("bg-zinc-950");
    expect(source).toContain("sections.map");
  });

  it("provides a modal mobile drawer with Escape and focus handling", () => {
    const source = read("../ui/app-header.tsx");
    expect(source).toContain("aria-expanded");
    expect(source).toContain("aria-controls");
    expect(source).toContain('role="dialog"');
    expect(source).toContain("aria-modal");
    expect(source).toContain('event.key === "Escape"');
    expect(source).toContain("focus()");
    const sidebar = read("../ui/app-sidebar.tsx");
    expect(sidebar).toContain("Uždaryti meniu");
  });

  it("renders contextual child navigation horizontally and scrollable", () => {
    const source = read("../../../shared/ui/section-tabs.tsx");
    expect(source).toContain("aria-current");
    expect(source).toContain("overflow-x-auto");
    expect(source).toContain("whitespace-nowrap");
  });

  it("wires the active destination into tabs and breadcrumb", () => {
    const source = read("../ui/app-shell.tsx");
    expect(source).toContain("SectionTabsProvider");
    expect(source).toContain("activeDestination");
    expect(source).toContain("DesktopSidebar");
    expect(source).toContain("breadcrumbTrail");
  });
});
