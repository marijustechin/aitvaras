import { describe, expect, it } from "vitest";
import type { ReceivingDiscrepancyRegisterRow } from "@aitvaras/contracts";
import {
  createDiscrepancyListFilters,
  DEFAULT_DISCREPANCY_STATUS_FILTER,
  discrepancyDetailHref,
  filterDiscrepancies,
  hasActiveDiscrepancyFilters,
  resourceFilterOptions,
  statusesForDiscrepancyFilter,
  supplierFilterOptions,
} from "./discrepancy-list";

function row(
  overrides: Partial<ReceivingDiscrepancyRegisterRow> = {},
): ReceivingDiscrepancyRegisterRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    batchId: "22222222-2222-4222-8222-222222222222",
    deliveryId: "33333333-3333-4333-8333-333333333333",
    deliveryCode: "G2610-01",
    batchCode: "P01",
    supplierId: "s1",
    supplierName: "Tiekėjas A",
    resourceId: "r1",
    resourceName: "Cukrus",
    warehouseName: "Pagrindinis",
    arrivalDate: "2026-10-01T00:00:00.000Z",
    measuredWeight: "980.000",
    documentWeight: "1000.000",
    differenceWeight: "-20.000",
    direction: "SHORTAGE",
    originalWeight: "20.000",
    settledWeight: "0.000",
    remainingWeight: "20.000",
    status: "OPEN",
    createdById: "44444444-4444-4444-8444-444444444444",
    createdByName: "Vardenis Pavardenis",
    createdAt: "2026-10-01T09:00:00.000Z",
    settledAt: null,
    ...overrides,
  };
}

describe("discrepancy register defaults", () => {
  it("defaults to the open discrepancies, direction All and no date bound", () => {
    const defaults = createDiscrepancyListFilters();
    expect(DEFAULT_DISCREPANCY_STATUS_FILTER).toBe("OPEN");
    expect(defaults.status).toBe("OPEN");
    expect(defaults.direction).toBe("ALL");
    expect(defaults.dateFrom).toBe("");
    expect(defaults.dateTo).toBe("");
    expect(hasActiveDiscrepancyFilters(defaults)).toBe(false);
  });

  it("detects changes from the default view", () => {
    const defaults = createDiscrepancyListFilters();
    expect(hasActiveDiscrepancyFilters({ ...defaults, status: "ALL" })).toBe(
      true,
    );
    expect(
      hasActiveDiscrepancyFilters({ ...defaults, direction: "OVERAGE" }),
    ).toBe(true);
    expect(
      hasActiveDiscrepancyFilters({ ...defaults, dateFrom: "2026-10-01" }),
    ).toBe(true);
  });
});

describe("statusesForDiscrepancyFilter", () => {
  it("maps the filter to the corresponding statuses", () => {
    expect(statusesForDiscrepancyFilter("OPEN")).toEqual(["OPEN"]);
    expect(statusesForDiscrepancyFilter("PARTIALLY_SETTLED")).toEqual([
      "PARTIALLY_SETTLED",
    ]);
    expect(statusesForDiscrepancyFilter("SETTLED")).toEqual(["SETTLED"]);
    expect(statusesForDiscrepancyFilter("ALL")).toEqual([
      "OPEN",
      "PARTIALLY_SETTLED",
      "SETTLED",
    ]);
  });
});

describe("filterDiscrepancies", () => {
  const open = row({ id: "open", status: "OPEN" });
  const partial = row({
    id: "partial",
    status: "PARTIALLY_SETTLED",
    settledWeight: "5.000",
    remainingWeight: "15.000",
  });
  const settled = row({
    id: "settled",
    status: "SETTLED",
    settledWeight: "20.000",
    remainingWeight: "0.000",
    settledAt: "2026-10-02T09:00:00.000Z",
  });
  const all = [open, partial, settled];

  it("shows only OPEN by default", () => {
    expect(
      filterDiscrepancies(all, createDiscrepancyListFilters()).map((r) => r.id),
    ).toEqual(["open"]);
  });

  it("filters by status", () => {
    expect(
      filterDiscrepancies(all, {
        ...createDiscrepancyListFilters(),
        status: "PARTIALLY_SETTLED",
      }).map((r) => r.id),
    ).toEqual(["partial"]);
    expect(
      filterDiscrepancies(all, {
        ...createDiscrepancyListFilters(),
        status: "ALL",
      }).map((r) => r.id),
    ).toEqual(["open", "partial", "settled"]);
  });

  it("filters by supplier, resource and direction", () => {
    const other = row({
      id: "other",
      supplierId: "s2",
      supplierName: "Tiekėjas B",
      resourceId: "r2",
      resourceName: "Druska",
      direction: "OVERAGE",
      differenceWeight: "+12.500",
      status: "OPEN",
    });
    expect(
      filterDiscrepancies([...all, other], {
        ...createDiscrepancyListFilters(),
        status: "ALL",
        supplierId: "s2",
      }).map((r) => r.id),
    ).toEqual(["other"]);
    expect(
      filterDiscrepancies([...all, other], {
        ...createDiscrepancyListFilters(),
        status: "ALL",
        resourceId: "r2",
      }).map((r) => r.id),
    ).toEqual(["other"]);
    expect(
      filterDiscrepancies([...all, other], {
        ...createDiscrepancyListFilters(),
        status: "ALL",
        direction: "SHORTAGE",
      }).map((r) => r.id),
    ).toEqual(["open", "partial", "settled"]);
  });

  it("filters by discrepancy date range inclusively", () => {
    const early = row({ id: "early", createdAt: "2026-09-01T09:00:00.000Z" });
    const late = row({ id: "late", createdAt: "2026-10-30T09:00:00.000Z" });
    const base = { ...createDiscrepancyListFilters(), status: "ALL" as const };
    expect(
      filterDiscrepancies([early, late], {
        ...base,
        dateFrom: "2026-10-01",
      }).map((r) => r.id),
    ).toEqual(["late"]);
    expect(
      filterDiscrepancies([early, late], {
        ...base,
        dateTo: "2026-09-15",
      }).map((r) => r.id),
    ).toEqual(["early"]);
  });

  it("searches the delivery code case-insensitively", () => {
    const other = row({
      id: "other",
      deliveryCode: "G2611-04",
      status: "OPEN",
    });
    expect(
      filterDiscrepancies([open, other], {
        ...createDiscrepancyListFilters(),
        code: "g2611",
      }).map((r) => r.id),
    ).toEqual(["other"]);
  });
});

describe("register filter options", () => {
  it("derives distinct, name-sorted supplier/resource options", () => {
    const rows = [
      row({ supplierId: "s2", supplierName: "Beta" }),
      row({ id: "b", supplierId: "s1", supplierName: "Alfa" }),
      row({ id: "c", supplierId: "s2", supplierName: "Beta" }),
    ];
    expect(supplierFilterOptions(rows)).toEqual([
      { id: "s1", name: "Alfa" },
      { id: "s2", name: "Beta" },
    ]);
    expect(resourceFilterOptions(rows)).toHaveLength(1);
  });
});

describe("discrepancyDetailHref", () => {
  it("links to the detail route", () => {
    expect(discrepancyDetailHref("abc")).toBe("/reports/discrepancies/abc");
  });
});
