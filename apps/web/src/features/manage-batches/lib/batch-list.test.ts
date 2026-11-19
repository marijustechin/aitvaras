import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Batch, IncomingDelivery } from "@aitvaras/contracts";
import { batchStatusLabel } from "@/entities/batch";
import {
  BATCH_STATUS_FILTERS,
  BATCH_STATUS_FILTER_LABELS,
  batchDetailHref,
  batchStatusClass,
  confirmedBatchesLabel,
  CONFIRM_RECEIPT_LABEL,
  createBatchListFilters,
  DEFAULT_BATCH_STATUS_FILTER,
  DELETE_RECEIPT_CONFIRM_LABEL,
  DELETE_RECEIPT_LABEL,
  filterBatches,
  GAVIMAI_HEADING,
  hasActiveBatchFilters,
  NO_BATCHES_STATUS_LABEL,
  paginateReceiptRows,
  parseBatchListFilters,
  receiptRows,
  receiptStatusLabel,
  RECEIPT_PAGE_SIZE,
  RESET_FILTERS_LABEL,
  resourceFilterOptions,
  statusesForFilter,
  supplierFilterOptions,
  supplierFilterOptionsWithReceipts,
  warehouseFilterOptions,
} from "./batch-list";

function batch(overrides: Partial<Batch> = {}): Batch {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    code: "P01",
    deliveryId: "99999999-9999-4999-8999-999999999999",
    deliveryCode: "G2609-01",
    receivingMode: "WEIGHT",
    resourceId: "22222222-2222-4222-8222-222222222222",
    resourceName: "Cukrus",
    resourceCategoryName: "Žaliava",
    supplierId: "33333333-3333-4333-8333-333333333333",
    supplierName: "Tiekėjas UAB",
    warehouseId: "44444444-4444-4444-8444-444444444444",
    warehouseName: "Pagrindinis",
    arrivalDate: "2026-09-29T00:00:00.000Z",
    status: "PENDING",
    documentWeight: null,
    documentPieces: null,
    difference: null,
    hasOpenDiscrepancy: false,
    acquisitionAmount: null,
    receiptId: null,
    receiptLineId: null,
    documentDate: null,
    documentNumber: null,
    confirmedAt: null,
    createdById: "55555555-5555-4555-8555-555555555555",
    createdByName: "Vardas Pavardė",
    bagCount: 2,
    totalNetWeight: "19.75",
    itemLineCount: 0,
    totalPieces: 0,
    createdAt: "2026-09-29T09:00:00.000Z",
    updatedAt: "2026-09-29T09:00:00.000Z",
    ...overrides,
  };
}

function emptyDelivery(
  overrides: Partial<IncomingDelivery> = {},
): IncomingDelivery {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    code: "G2611-02",
    supplierId: "33333333-3333-4333-8333-333333333333",
    supplierName: "Tiekėjas UAB",
    arrivalDate: "2026-09-29T00:00:00.000Z",
    createdById: "55555555-5555-4555-8555-555555555555",
    createdByName: "Vardas Pavardė",
    batchCount: 0,
    pendingBatchCount: 0,
    hasNonZeroExpenses: false,
    createdAt: "2026-09-29T10:00:00.000Z",
    updatedAt: "2026-09-29T10:00:00.000Z",
    ...overrides,
  };
}

describe("Priėmimas heading and default queue", () => {
  it("uses the received-batch heading", () => {
    expect(GAVIMAI_HEADING).toBe("Priėmimai");
  });

  it("defaults to the Laukia patvirtinimo queue", () => {
    expect(DEFAULT_BATCH_STATUS_FILTER).toBe("PENDING");
    expect(createBatchListFilters().status).toBe("PENDING");
  });

  it("offers exactly the three receipt status options", () => {
    expect(BATCH_STATUS_FILTERS).toEqual(["PENDING", "CONFIRMED", "ALL"]);
    expect(BATCH_STATUS_FILTER_LABELS).toEqual({
      PENDING: "Laukia patvirtinimo",
      CONFIRMED: "Patvirtinta",
      ALL: "Visos",
    });
  });
});

describe("reset filters", () => {
  it("exposes the reset action label", () => {
    expect(RESET_FILTERS_LABEL).toBe("Atstatyti filtrus");
  });

  it("restores valid persisted filters and rejects malformed values", () => {
    const restored = parseBatchListFilters(
      JSON.stringify({
        status: "ALL",
        supplierId: "s1",
        arrivalFrom: "2026-11-18",
        code: "P01",
      }),
    );
    expect(restored).toMatchObject({
      status: "ALL",
      supplierId: "s1",
      arrivalFrom: "2026-11-18",
      code: "P01",
    });
    expect(parseBatchListFilters("not-json")).toEqual(createBatchListFilters());
    expect(
      parseBatchListFilters(JSON.stringify({ status: "BOGUS" })).status,
    ).toBe(DEFAULT_BATCH_STATUS_FILTER);
    expect(
      parseBatchListFilters(
        JSON.stringify({
          status: "NEEDS_CONFIRMATION",
          supplierId: "s2",
          code: "P02",
        }),
      ),
    ).toMatchObject({
      status: "PENDING",
      supplierId: "s2",
      code: "P02",
    });
  });

  it("detects whether any filter differs from the default view", () => {
    const defaults = createBatchListFilters();
    expect(hasActiveBatchFilters(defaults)).toBe(false);
    expect(hasActiveBatchFilters({ ...defaults, status: "CONFIRMED" })).toBe(
      true,
    );
    expect(hasActiveBatchFilters({ ...defaults, status: "ALL" })).toBe(true);
    expect(hasActiveBatchFilters({ ...defaults, supplierId: "s1" })).toBe(true);
    expect(
      hasActiveBatchFilters({ ...defaults, arrivalFrom: "2026-09-01" }),
    ).toBe(true);
    expect(hasActiveBatchFilters({ ...defaults, code: "P01" })).toBe(true);
  });

  it("keeps arrival date filters empty by default (no forced range)", () => {
    const defaults = createBatchListFilters();
    expect(defaults.arrivalFrom).toBe("");
    expect(defaults.arrivalTo).toBe("");
  });

  it("resets to the default status and clears the date filters", () => {
    const reset = createBatchListFilters();
    expect(reset.status).toBe(DEFAULT_BATCH_STATUS_FILTER);
    expect(reset.arrivalFrom).toBe("");
    expect(reset.arrivalTo).toBe("");
  });
});

describe("statusesForFilter", () => {
  it("maps Laukia patvirtinimo to the not-yet-confirmed PENDING batches", () => {
    expect(statusesForFilter("PENDING")).toEqual(["PENDING"]);
  });

  it("maps the individual status filters", () => {
    expect(statusesForFilter("CONFIRMED")).toEqual(["CONFIRMED"]);
    expect(statusesForFilter("ALL")).toEqual(["PENDING", "CONFIRMED"]);
  });
});

describe("filterBatches", () => {
  const pending = batch({ id: "p", code: "P01", status: "PENDING" });
  const confirmed = batch({
    id: "c",
    code: "P03",
    status: "CONFIRMED",
    confirmedAt: "2026-09-30T10:00:00.000Z",
  });

  it("applies the default Laukia patvirtinimo queue (PENDING only)", () => {
    const visible = filterBatches([pending, confirmed], {
      ...createBatchListFilters(),
    });
    expect(visible.map((item) => item.id)).toEqual(["p"]);
  });

  it("filters by an individual status", () => {
    expect(
      filterBatches([pending, confirmed], {
        ...createBatchListFilters(),
        status: "CONFIRMED",
      }).map((item) => item.id),
    ).toEqual(["c"]);
    expect(
      filterBatches([pending, confirmed], {
        ...createBatchListFilters(),
        status: "ALL",
      }).map((item) => item.id),
    ).toEqual(["p", "c"]);
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

  it("keeps local-midnight arrivals on their calendar day in inclusive ranges", () => {
    const localMidnight = new Date(2026, 10, 18, 0, 0, 0, 0).toISOString();
    const item = batch({ id: "midnight", arrivalDate: localMidnight });
    expect(
      filterBatches([item], {
        ...createBatchListFilters(),
        arrivalFrom: "2026-11-18",
        arrivalTo: "2026-11-18",
      }).map((entry) => entry.id),
    ).toEqual(["midnight"]);
  });

  it("searches the batch code case-insensitively", () => {
    expect(
      filterBatches([pending, confirmed], {
        ...createBatchListFilters(),
        status: "ALL",
        code: "P03",
      }).map((item) => item.id),
    ).toEqual(["c"]);
    expect(
      filterBatches([pending, confirmed], {
        ...createBatchListFilters(),
        status: "ALL",
        code: "p01",
      }).map((item) => item.id),
    ).toEqual(["p"]);
  });
});

describe("receipt rows", () => {
  const deliveryId = "99999999-9999-4999-8999-999999999999";
  const delivery = emptyDelivery({
    id: deliveryId,
    code: "G2609-01",
    batchCount: 2,
    pendingBatchCount: 2,
  });
  const pending = (id: string, code: string, patch: Partial<Batch> = {}) =>
    batch({ id, code, deliveryId, status: "PENDING", ...patch });
  const confirmed = (id: string, code: string, patch: Partial<Batch> = {}) =>
    batch({
      id,
      code,
      deliveryId,
      status: "CONFIRMED",
      confirmedAt: "2026-09-30T10:00:00.000Z",
      ...patch,
    });

  it("shows one receipt row with the confirmation count and status", () => {
    const rows = receiptRows(
      [pending("p1", "P01"), pending("p2", "P02")],
      [delivery],
      createBatchListFilters(),
    );
    expect(rows).toHaveLength(1);
    expect(confirmedBatchesLabel(rows[0]!)).toBe("0 iš 2");
    expect(receiptStatusLabel(rows[0]!.status)).toBe("Laukia patvirtinimo");

    const partial = receiptRows(
      [pending("p1", "P01"), confirmed("p2", "P02")],
      [delivery],
      createBatchListFilters(),
    );
    expect(confirmedBatchesLabel(partial[0]!)).toBe("1 iš 2");
    expect(partial[0]!.status).toBe("PENDING");

    const complete = receiptRows(
      [confirmed("p1", "P01"), confirmed("p2", "P02")],
      [delivery],
      { ...createBatchListFilters(), status: "ALL" },
    );
    expect(confirmedBatchesLabel(complete[0]!)).toBe("2 iš 2");
    expect(complete[0]!.status).toBe("CONFIRMED");
    expect(receiptStatusLabel(complete[0]!.status)).toBe("Patvirtintas");
  });

  it("includes zero-batch receipts only in Visos", () => {
    const empty = emptyDelivery({ id: "empty-delivery", code: "G2609-09" });
    expect(
      receiptRows([], [empty], createBatchListFilters()).length,
    ).toBe(0);
    const all = receiptRows([], [empty], {
      ...createBatchListFilters(),
      status: "ALL",
    });
    expect(all).toHaveLength(1);
    expect(confirmedBatchesLabel(all[0]!)).toBe("—");
    expect(receiptStatusLabel(all[0]!.status)).toBe("Be partijų");
  });

  it("matches a receipt once when any batch matches batch-specific filters", () => {
    const rows = receiptRows(
      [
        pending("p1", "P01", { resourceId: "r1", warehouseId: "w1" }),
        pending("p2", "P02", { resourceId: "r2", warehouseId: "w2" }),
      ],
      [
        emptyDelivery({
          id: deliveryId,
          batchCount: 2,
          pendingBatchCount: 2,
        }),
      ],
      {
        ...createBatchListFilters(),
        resourceId: "r2",
      },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.batches).toHaveLength(2);

    expect(
      receiptRows(
        [pending("p1", "P01", { resourceId: "r1" })],
        [delivery],
        {
          ...createBatchListFilters(),
          resourceId: "unknown",
        },
      ),
    ).toEqual([]);
  });

  it("applies supplier and date filters to both row types", () => {
    const empty = emptyDelivery({
      id: "empty-delivery",
      supplierId: "other",
    });
    expect(
      receiptRows([], [empty], {
        ...createBatchListFilters(),
        status: "ALL",
        supplierId: "other",
      }),
    ).toHaveLength(1);
    expect(
      receiptRows([], [empty], {
        ...createBatchListFilters(),
        status: "ALL",
        arrivalFrom: "2026-09-30",
      }),
    ).toHaveLength(0);
  });

  it("paginates after grouping", () => {
    const many = Array.from({ length: 3 }, (_, index) =>
      emptyDelivery({
        id: `delivery-${index}`,
        code: `G2609-${String(index + 1).padStart(2, "0")}`,
        createdAt: `2026-09-${String(29 - index).padStart(2, "0")}T10:00:00.000Z`,
      }),
    );
    const rows = receiptRows([], many, {
      ...createBatchListFilters(),
      status: "ALL",
    });
    const first = paginateReceiptRows(rows, 1, 2);
    const second = paginateReceiptRows(rows, 2, 2);
    expect(first.rows).toHaveLength(2);
    expect(first.total).toBe(3);
    expect(first.totalPages).toBe(2);
    expect(second.rows).toHaveLength(1);
    expect(second.from).toBe(3);
    expect(RECEIPT_PAGE_SIZE).toBeGreaterThan(0);
  });

  it("uses the receipt status and delete labels", () => {
    expect(NO_BATCHES_STATUS_LABEL).toBe("Be partijų");
    expect(DELETE_RECEIPT_LABEL).toBe("Ištrinti priėmimą");
    expect(DELETE_RECEIPT_CONFIRM_LABEL).toBe("Ištrinti");
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

  it("includes suppliers that only have batch-less receipts", () => {
    const emptyOnly = emptyDelivery({
      supplierId: "s9",
      supplierName: "Tik tuščias",
    });
    expect(
      supplierFilterOptionsWithReceipts(
        [batch({ supplierId: "s1", supplierName: "Alfa" })],
        [emptyOnly],
      ),
    ).toEqual([
      { id: "s1", name: "Alfa" },
      { id: "s9", name: "Tik tuščias" },
    ]);
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
    expect(batchStatusLabel("PENDING")).toBe("Laukiama patvirtinimo");
  });

  it("maps statuses to restrained semantic colours", () => {
    expect(batchStatusClass("CONFIRMED")).toContain("emerald");
    expect(batchStatusClass("PENDING")).toContain("muted");
  });
});

describe("Priėmimai receipt list rendering (source)", () => {
  const source = readFileSync(
    fileURLToPath(new URL("../ui/gavimai-page.tsx", import.meta.url)),
    "utf8",
  );

  it("renders one receipt row with the required columns", () => {
    expect(source).toContain("receiptRows");
    expect(source).toContain("confirmedBatchesLabel");
    expect(source).toContain("Patvirtintos partijos");
    expect(source).toContain("row.delivery.code");
    expect(source).toContain("`/receipts/${row.delivery.id}`");
    expect(source).toContain("`/receiving/${row.delivery.id}`");
  });

  it("gives the receipt number and action distinct destinations", () => {
    expect(source).toContain("`/receiving/${row.delivery.id}`");
    expect(source).toContain("`/receipts/${row.delivery.id}`");
    expect(source).toContain("canConfirm");
    expect(source).toContain("Tvirtinti");
    expect(source).toContain("Peržiūrėti");
    expect(source).toContain("DELETE_RECEIPT_LABEL");
    expect(source).toContain("EMPTY_RECEIPT_EXPENSE_BLOCK_MESSAGE");
  });

  it("offers filter reset and pagination", () => {
    expect(source).toContain("RESET_FILTERS_LABEL");
    expect(source).toContain("hasActiveBatchFilters");
    expect(source).toContain("paginateReceiptRows");
    expect(source).toContain("Ankstesnis");
    expect(source).toContain("Kitas");
  });

  it("uses masculine Visi for the generic filter options", () => {
    expect(source).toContain(">Visi<");
  });
});

describe("receipt manager screen (source)", () => {
  const source = readFileSync(
    fileURLToPath(new URL("../ui/receipt-manager-page.tsx", import.meta.url)),
    "utf8",
  );
  const expenseSource = readFileSync(
    fileURLToPath(new URL("../ui/delivery-expenses.tsx", import.meta.url)),
    "utf8",
  );

  it("uses the manager table labels and per-batch action", () => {
    expect(source).toContain("Priėmimas {delivery.code}");
    expect(source).toContain("Prekė");
    expect(source).toContain("Priimta");
    expect(source).toContain("Dokumentuose");
    expect(source).toContain("Skirtumas");
    expect(source).toContain("Įsigijimo vertė, €");
    expect(source).toContain("Patvirtinti ${batch.code}");
    expect(source).toContain("{batch.code} prekės");
    expect(source).toContain("DeliveryExpensesBlock");
    expect(expenseSource).toContain("Priėmimo išlaidos");
  });

  it("groups the expanded batch and labels its toggle", () => {
    expect(source).toContain("data-batch-code={batch.code}");
    expect(source).toContain("aria-expanded={expanded}");
    expect(source).toContain("\"Rodyti prekes\"");
    expect(source).toContain("\"Slėpti prekes\"");
    expect(source).toContain("\"Dokumento duomenys\"");
    expect(source).toContain("batch-panel-${batch.id}");
    expect(source).toContain("ChevronIcon");
  });

  it("marks required manager fields for accessible field-level validation", () => {
    expect(source).toContain("managerInputClass(");
    expect(source).toContain("aria-required=\"true\"");
    expect(source).toContain("aria-invalid={rowInvalid}");
    expect(source).toContain("showRequired && !isPieceCountValid(value)");
    expect(source).toContain("isAcquisitionAmountValid(acquisition)");
  });

  it("keeps itemised and total PIECE document forms", () => {
    expect(source).toContain("Pagal prekes");
    expect(source).toContain("Bendras kiekis");
    expect(source).toContain("pieceRowDifference");
    expect(source).toContain("pieceConfirmationDifference");
  });
});

describe("Priėmimas detail terminology", () => {
  it("uses the Priėmimas confirmation wording", () => {
    expect(CONFIRM_RECEIPT_LABEL).toBe("Patvirtinti priėmimą");
  });
});

describe("Priėmimas detail page (source)", () => {
  const source = readFileSync(
    fileURLToPath(new URL("../ui/batch-details-page.tsx", import.meta.url)),
    "utf8",
  );

  it("links back to the Priėmimas queue, not the removed Partijos list", () => {
    expect(source).toContain("GAVIMAI_ACTION.href");
    expect(source).toContain("GAVIMAI_ACTION.label");
    expect(source).not.toContain('"/receipts/batches"');
  });

  it("uses Patvirtinti priėmimą and no stale pajamavimą wording", () => {
    expect(source).toContain("CONFIRM_RECEIPT_LABEL");
    expect(source).not.toContain("Patvirtinti pajamavimą");
    expect(source).not.toMatch(/[Pp]ajamavim/);
  });

  it("shows the unit status and the correction history", () => {
    expect(source).toContain("Pataisymų istorija");
    expect(source).toContain("correctionKindLabel");
    expect(source).toContain("bagStatusLabel");
  });

  it("shows the human-facing delivery code", () => {
    expect(source).toContain("batch.deliveryCode");
  });
});

describe("receiving terminology in the ADMIN views (source)", () => {
  const gavimai = readFileSync(
    fileURLToPath(new URL("../ui/gavimai-page.tsx", import.meta.url)),
    "utf8",
  );
  const details = readFileSync(
    fileURLToPath(new URL("../ui/batch-details-page.tsx", import.meta.url)),
    "utf8",
  );

  it("uses generic Pakuotės wording, not bag-specific Maišai", () => {
    expect(gavimai).toContain("Patvirtintos partijos");
    expect(gavimai).not.toContain("Maišai");
    expect(details).toContain("Partijos pakuotės");
    expect(details).not.toContain("Partijos maišai");
  });

  it("never uses bag-specific Maišas wording for physical packages", () => {
    expect(gavimai).not.toMatch(/[Mm]aiš/);
    expect(details).not.toMatch(/[Mm]aiš/);
  });

  it("shows the compact delivery-local batch code (P01)", () => {
    expect(gavimai).toContain("row.delivery.code");
    expect(gavimai).toContain("confirmedBatchesLabel");
    expect(details).toContain("batch.code");
    expect(gavimai).not.toMatch(/P-\d{4}/);
    expect(details).not.toMatch(/P-\d{4}/);
  });
});
