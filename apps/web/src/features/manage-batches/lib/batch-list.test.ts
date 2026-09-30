import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Batch } from "@aitvaras/contracts";
import { batchStatusLabel } from "@/entities/batch";
import {
  batchDetailHref,
  batchStatusClass,
  CONFIRM_RECEIPT_LABEL,
  createBatchListFilters,
  DEFAULT_BATCH_STATUS_FILTER,
  filterBatches,
  GAVIMAI_HEADING,
  hasActiveBatchFilters,
  RESET_FILTERS_LABEL,
  resourceFilterOptions,
  statusesForFilter,
  supplierFilterOptions,
  warehouseFilterOptions,
} from "./batch-list";

function batch(overrides: Partial<Batch> = {}): Batch {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    code: "P-2026-000001",
    resourceId: "22222222-2222-4222-8222-222222222222",
    resourceName: "Cukrus",
    resourceCategoryName: "Žaliava",
    supplierId: "33333333-3333-4333-8333-333333333333",
    supplierName: "Tiekėjas UAB",
    warehouseId: "44444444-4444-4444-8444-444444444444",
    warehouseName: "Pagrindinis",
    arrivalDate: "2026-09-29T00:00:00.000Z",
    status: "PENDING",
    unit: "KG",
    documentWeight: null,
    difference: null,
    acquisitionAmount: null,
    receiptId: null,
    receiptLineId: null,
    documentDate: null,
    documentNumber: null,
    confirmedAt: null,
    createdById: "55555555-5555-4555-8555-555555555555",
    createdByName: "Vardas Pavardė",
    bagCount: 2,
    totalQuantity: "19.75",
    createdAt: "2026-09-29T09:00:00.000Z",
    updatedAt: "2026-09-29T09:00:00.000Z",
    ...overrides,
  };
}

describe("Gavimai heading and default queue", () => {
  it("uses the received-batch heading", () => {
    expect(GAVIMAI_HEADING).toBe("Gautos partijos");
  });

  it("defaults to the Reikia patvirtinti queue", () => {
    expect(DEFAULT_BATCH_STATUS_FILTER).toBe("NEEDS_CONFIRMATION");
    expect(createBatchListFilters().status).toBe("NEEDS_CONFIRMATION");
  });
});

describe("reset filters", () => {
  it("exposes the reset action label", () => {
    expect(RESET_FILTERS_LABEL).toBe("Atstatyti filtrus");
  });

  it("detects whether any filter differs from the default view", () => {
    const defaults = createBatchListFilters();
    expect(hasActiveBatchFilters(defaults)).toBe(false);
    expect(hasActiveBatchFilters({ ...defaults, status: "CONFIRMED" })).toBe(
      true,
    );
    expect(hasActiveBatchFilters({ ...defaults, supplierId: "s1" })).toBe(true);
    expect(
      hasActiveBatchFilters({ ...defaults, arrivalFrom: "2026-09-01" }),
    ).toBe(true);
    expect(hasActiveBatchFilters({ ...defaults, code: "P-2026" })).toBe(true);
  });
});

describe("statusesForFilter", () => {
  it("maps Reikia patvirtinti to PENDING + DISCREPANCY", () => {
    expect(statusesForFilter("NEEDS_CONFIRMATION")).toEqual([
      "PENDING",
      "DISCREPANCY",
    ]);
  });

  it("maps the individual status filters", () => {
    expect(statusesForFilter("PENDING")).toEqual(["PENDING"]);
    expect(statusesForFilter("DISCREPANCY")).toEqual(["DISCREPANCY"]);
    expect(statusesForFilter("CONFIRMED")).toEqual(["CONFIRMED"]);
    expect(statusesForFilter("ALL")).toEqual([
      "PENDING",
      "CONFIRMED",
      "DISCREPANCY",
    ]);
  });
});

describe("filterBatches", () => {
  const pending = batch({ id: "p", code: "P-2026-000001", status: "PENDING" });
  const discrepancy = batch({
    id: "d",
    code: "P-2026-000002",
    status: "DISCREPANCY",
  });
  const confirmed = batch({
    id: "c",
    code: "P-2026-000003",
    status: "CONFIRMED",
    confirmedAt: "2026-09-30T10:00:00.000Z",
  });

  it("applies the default Reikia patvirtinti queue (PENDING + DISCREPANCY)", () => {
    const visible = filterBatches([pending, discrepancy, confirmed], {
      ...createBatchListFilters(),
    });
    expect(visible.map((item) => item.id)).toEqual(["p", "d"]);
  });

  it("filters by an individual status", () => {
    expect(
      filterBatches([pending, discrepancy, confirmed], {
        ...createBatchListFilters(),
        status: "CONFIRMED",
      }).map((item) => item.id),
    ).toEqual(["c"]);
    expect(
      filterBatches([pending, discrepancy, confirmed], {
        ...createBatchListFilters(),
        status: "DISCREPANCY",
      }).map((item) => item.id),
    ).toEqual(["d"]);
  });

  it("filters by supplier, resource and warehouse", () => {
    const other = batch({
      id: "other",
      supplierId: "s2",
      resourceId: "r2",
      warehouseId: "w2",
    });
    const all = [pending, other];

    expect(
      filterBatches(all, { ...createBatchListFilters(), supplierId: "s2" }).map(
        (item) => item.id,
      ),
    ).toEqual(["other"]);
    expect(
      filterBatches(all, { ...createBatchListFilters(), resourceId: "r2" }).map(
        (item) => item.id,
      ),
    ).toEqual(["other"]);
    expect(
      filterBatches(all, { ...createBatchListFilters(), warehouseId: "w2" }).map(
        (item) => item.id,
      ),
    ).toEqual(["other"]);
  });

  it("filters by arrival date range (inclusive)", () => {
    const early = batch({
      id: "early",
      arrivalDate: "2026-09-01T00:00:00.000Z",
    });
    const late = batch({ id: "late", arrivalDate: "2026-09-30T00:00:00.000Z" });
    const all = [early, late];

    expect(
      filterBatches(all, {
        ...createBatchListFilters(),
        arrivalFrom: "2026-09-15",
      }).map((item) => item.id),
    ).toEqual(["late"]);
    expect(
      filterBatches(all, {
        ...createBatchListFilters(),
        arrivalTo: "2026-09-15",
      }).map((item) => item.id),
    ).toEqual(["early"]);
    expect(
      filterBatches(all, {
        ...createBatchListFilters(),
        arrivalFrom: "2026-09-01",
        arrivalTo: "2026-09-30",
      }).map((item) => item.id),
    ).toEqual(["early", "late"]);
  });

  it("searches the batch code case-insensitively", () => {
    expect(
      filterBatches([pending, confirmed], {
        ...createBatchListFilters(),
        status: "ALL",
        code: "00003",
      }).map((item) => item.id),
    ).toEqual(["c"]);
    expect(
      filterBatches([pending, confirmed], {
        ...createBatchListFilters(),
        status: "ALL",
        code: "p-2026-000001",
      }).map((item) => item.id),
    ).toEqual(["p"]);
  });
});

describe("filter options", () => {
  it("derives distinct, name-sorted supplier/resource/warehouse options", () => {
    const all = [
      batch({ supplierId: "s2", supplierName: "Beta" }),
      batch({ id: "b", supplierId: "s1", supplierName: "Alfa" }),
      batch({ id: "c", supplierId: "s2", supplierName: "Beta" }),
    ];
    expect(supplierFilterOptions(all)).toEqual([
      { id: "s1", name: "Alfa" },
      { id: "s2", name: "Beta" },
    ]);
    expect(resourceFilterOptions(all)).toHaveLength(1);
    expect(warehouseFilterOptions(all)).toHaveLength(1);
  });
});

describe("batchDetailHref", () => {
  it("links to the ADMIN detail/reconciliation screen", () => {
    expect(batchDetailHref("abc")).toBe("/receipts/batches/abc");
  });
});

describe("batch status display", () => {
  it("maps statuses to Lithuanian labels", () => {
    expect(batchStatusLabel("CONFIRMED")).toBe("Patvirtinta");
    expect(batchStatusLabel("DISCREPANCY")).toBe("Neatitikimas");
    expect(batchStatusLabel("PENDING")).toBe("Laukiama patvirtinimo");
  });

  it("maps statuses to restrained semantic colours", () => {
    expect(batchStatusClass("CONFIRMED")).toContain("emerald");
    expect(batchStatusClass("DISCREPANCY")).toContain("rose");
    expect(batchStatusClass("PENDING")).toContain("muted");
  });
});

describe("Gavimai row rendering (source)", () => {
  const source = readFileSync(
    fileURLToPath(new URL("../ui/gavimai-page.tsx", import.meta.url)),
    "utf8",
  );

  it("has no separate Peržiūrėti action column", () => {
    expect(source).not.toContain("Peržiūrėti");
  });

  it("links each row to the batch detail", () => {
    expect(source).toContain("batchDetailHref(batch.id)");
    // The stretched link makes the whole row clickable without nested controls.
    expect(source).toContain("absolute inset-0");
  });

  it("offers a filter reset control", () => {
    expect(source).toContain("RESET_FILTERS_LABEL");
    expect(source).toContain("hasActiveBatchFilters");
  });
});

describe("Gavimai detail terminology", () => {
  it("uses the Gavimai confirmation wording", () => {
    expect(CONFIRM_RECEIPT_LABEL).toBe("Patvirtinti gavimą");
  });
});

describe("Gavimai detail page (source)", () => {
  const source = readFileSync(
    fileURLToPath(new URL("../ui/batch-details-page.tsx", import.meta.url)),
    "utf8",
  );

  it("links back to the Gavimai queue, not the removed Partijos list", () => {
    expect(source).toContain("GAVIMAI_ACTION.href");
    expect(source).toContain("GAVIMAI_ACTION.label");
    expect(source).not.toContain('"/receipts/batches"');
  });

  it("uses Patvirtinti gavimą and no stale pajamavimą wording", () => {
    expect(source).toContain("CONFIRM_RECEIPT_LABEL");
    expect(source).not.toContain("Patvirtinti pajamavimą");
    expect(source).not.toMatch(/[Pp]ajamavim/);
  });

  it("shows the unit status and the correction history", () => {
    expect(source).toContain("Pataisymų istorija");
    expect(source).toContain("correctionKindLabel");
    expect(source).toContain("bagStatusLabel");
  });
});
