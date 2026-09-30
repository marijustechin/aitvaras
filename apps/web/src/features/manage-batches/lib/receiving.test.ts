import { describe, expect, it } from "vitest";
import type { Bag, Batch, BatchDetail } from "@aitvaras/contracts";
import {
  activeBatchUnits,
  applyUnitSaveFailed,
  applyUnitSaved,
  applyUnitSavedSilently,
  BAG_RECEIVING_FIELDS,
  BAG_SURFACES,
  bagLabelData,
  bagSurface,
  batchReceivingContext,
  batchUnitRow,
  batchUnitsNewestFirst,
  BATCH_UNITS_HEADING,
  closeLabel,
  CORRECTION_BATCHES_HEADING,
  CORRECT_LABEL,
  EMPTY_BATCH_UNITS_MESSAGE,
  EMPTY_OPEN_BATCHES_MESSAGE,
  enterBagMode,
  FORMAL_RECONCILIATION_FIELDS,
  initialBagModeState,
  NEW_BATCH_LABEL,
  openLabel,
  openReceivingBatches,
  RECEIVING_MODES,
  REPRINT_LABEL,
  SAVE_AND_PRINT_LABEL,
  SAVE_LABEL,
  UNCONFIRMED_BATCHES_HEADING,
  VOID_LABEL,
  voidedBatchUnits,
  WORKER_BATCH_CONTEXT_FIELDS,
} from "./receiving";

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
    bagCount: 3,
    totalQuantity: "123.5",
    createdAt: "2026-09-29T09:00:00.000Z",
    updatedAt: "2026-09-29T09:00:00.000Z",
    ...overrides,
  };
}

function detail(overrides: Partial<BatchDetail> = {}): BatchDetail {
  return {
    ...batch(),
    bags: [],
    corrections: [],
    suggestedLocationId: null,
    ...overrides,
  };
}

const bag: Bag = {
  id: "66666666-6666-4666-8666-666666666666",
  barcode: "2012345678903",
  batchId: "11111111-1111-4111-8111-111111111111",
  batchCode: "P-2026-000001",
  quantity: "25.5",
  unit: "KG",
  status: "ACTIVE",
  warehouseLocationId: "77777777-7777-4777-8777-777777777777",
  warehouseLocationName: "Stelažas A1",
  voidedById: null,
  voidedByName: null,
  voidedAt: null,
  voidReason: null,
  createdById: "55555555-5555-4555-8555-555555555555",
  createdByName: "Vardas Pavardė",
  createdAt: "2026-09-29T09:05:00.000Z",
  updatedAt: "2026-09-29T09:05:00.000Z",
};

describe("receiving modes", () => {
  it("offers choose / new / bag modes and a new-batch label", () => {
    expect(RECEIVING_MODES).toContain("choose");
    expect(RECEIVING_MODES).toContain("new");
    expect(RECEIVING_MODES).toContain("bag");
    expect(NEW_BATCH_LABEL).toBe("Nauja partija");
  });
});

describe("openReceivingBatches", () => {
  it("keeps PENDING and DISCREPANCY batches, dropping CONFIRMED", () => {
    const result = openReceivingBatches([
      batch({ id: "a", status: "PENDING" }),
      batch({ id: "b", status: "CONFIRMED" }),
      batch({ id: "c", status: "DISCREPANCY" }),
    ]);
    expect(result.map((item) => item.id)).toEqual(["a", "c"]);
  });

  it("has a dedicated empty-state message", () => {
    expect(EMPTY_OPEN_BATCHES_MESSAGE).toBe("Nėra atvirų partijų.");
  });

  it("exposes the correction labels and heading", () => {
    expect(CORRECTION_BATCHES_HEADING).toBe("Reikia patikslinti");
    expect(CORRECT_LABEL).toBe("Taisyti");
    expect(VOID_LABEL).toBe("Anuliuoti");
  });
});

describe("active/voided unit split", () => {
  const active = { ...bag, id: "active", status: "ACTIVE" as const };
  const voided = {
    ...bag,
    id: "voided",
    status: "VOIDED" as const,
    voidedByName: "Vardas Pavardė",
    voidedAt: "2026-09-29T10:00:00.000Z",
    voidReason: "Sugedęs",
  };

  it("splits units by status, newest first", () => {
    const list = detail({ bags: [voided, active] });
    expect(activeBatchUnits(list).map((item) => item.id)).toEqual(["active"]);
    expect(voidedBatchUnits(list).map((item) => item.id)).toEqual(["voided"]);
  });
});

describe("batchReceivingContext", () => {
  it("inherits supplier, resource and warehouse from the batch", () => {
    const context = batchReceivingContext(batch());
    expect(context.batchId).toBe("11111111-1111-4111-8111-111111111111");
    expect(context.supplierId).toBe("33333333-3333-4333-8333-333333333333");
    expect(context.resourceId).toBe("22222222-2222-4222-8222-222222222222");
    expect(context.warehouseId).toBe("44444444-4444-4444-8444-444444444444");
  });

  it("carries the worker-facing context fields, including unit and total", () => {
    const context = batchReceivingContext(batch());
    expect(context.code).toBe("P-2026-000001");
    expect(context.supplierName).toBe("Tiekėjas UAB");
    expect(context.resourceName).toBe("Cukrus");
    expect(context.resourceCategoryName).toBe("Žaliava");
    expect(context.warehouseName).toBe("Pagrindinis");
    expect(context.arrivalDate).toBe("2026-09-29T00:00:00.000Z");
    expect(context.bagCount).toBe(3);
    expect(context.totalQuantity).toBe("123.5");
    expect(context.unit).toBe("KG");
  });

  it("reports no established unit for an empty batch", () => {
    expect(batchReceivingContext(batch({ unit: null })).unit).toBeNull();
  });
});

describe("bagLabelData", () => {
  it("includes the barcode, batch code, quantity, unit and metadata", () => {
    const label = bagLabelData(batch(), bag);
    expect(label.barcode).toBe("2012345678903");
    expect(label.batchCode).toBe("P-2026-000001");
    expect(label.quantity).toBe("25.5");
    expect(label.unit).toBe("KG");
    expect(label.resourceName).toBe("Cukrus");
    expect(label.categoryName).toBe("Žaliava");
    expect(label.warehouseName).toBe("Pagrindinis");
    expect(label.locationName).toBe("Stelažas A1");
  });
});

describe("field separation", () => {
  it("exposes only location, unit and quantity to the worker", () => {
    expect([...BAG_RECEIVING_FIELDS]).toEqual([
      "warehouseLocationId",
      "unit",
      "quantity",
    ]);
  });

  it("keeps formal reconciliation fields out of the worker flow", () => {
    for (const field of FORMAL_RECONCILIATION_FIELDS) {
      expect(BAG_RECEIVING_FIELDS as readonly string[]).not.toContain(field);
      expect(WORKER_BATCH_CONTEXT_FIELDS as readonly string[]).not.toContain(
        field,
      );
    }
  });

  it("lists documentary fields as formal-only", () => {
    expect(FORMAL_RECONCILIATION_FIELDS).toContain("documentWeight");
    expect(FORMAL_RECONCILIATION_FIELDS).toContain("acquisitionAmount");
    expect(FORMAL_RECONCILIATION_FIELDS).toContain("documentNumber");
    expect(FORMAL_RECONCILIATION_FIELDS).toContain("documentDate");
  });
});

describe("bag mode state", () => {
  const locationId = "77777777-7777-4777-8777-777777777777";

  it("has only form and label surfaces (no intermediate detail)", () => {
    expect([...BAG_SURFACES]).toEqual(["form", "label"]);
    expect(BAG_SURFACES as readonly string[]).not.toContain("detail");
  });

  it("starts on the entry form with no batch", () => {
    const state = initialBagModeState();
    expect(state.batch).toBeNull();
    expect(state.label).toBeNull();
    expect(bagSurface(state)).toBe("form");
  });

  it("entering a batch shows the form with the batch's suggested draft", () => {
    const state = enterBagMode(
      detail({ unit: "PCS", suggestedLocationId: locationId }),
    );
    expect(state.batch).not.toBeNull();
    expect(state.label).toBeNull();
    expect(state.draft).toEqual({
      unit: "PCS",
      quantity: "",
      warehouseLocationId: locationId,
    });
    expect(bagSurface(state)).toBe("form");
  });

  it("a successful save goes straight to the label (no detail state)", () => {
    const state = applyUnitSaved(
      detail({ unit: "KG", suggestedLocationId: locationId, bagCount: 4 }),
      bag,
    );
    expect(bagSurface(state)).toBe("label");
    expect(state.label).toBe(bag);
    expect(state.batch).not.toBeNull();
  });

  it("closing the label returns to the form, preserving batch and next draft", () => {
    const saved = applyUnitSaved(
      detail({ unit: "KG", suggestedLocationId: locationId }),
      bag,
    );
    const closed = closeLabel(saved);
    expect(bagSurface(closed)).toBe("form");
    expect(closed.label).toBeNull();
    expect(closed.batch).toBe(saved.batch);
    expect(closed.draft).toEqual(saved.draft);
  });

  it("prepares the next draft: same unit + location, quantity reset", () => {
    const state = applyUnitSaved(
      detail({ unit: "PCS", suggestedLocationId: locationId }),
      bag,
    );
    expect(state.draft).toEqual({
      unit: "PCS",
      quantity: "",
      warehouseLocationId: locationId,
    });
  });

  it("a failed save never opens the label and keeps the draft", () => {
    const before = enterBagMode(detail({ unit: "KG", suggestedLocationId: locationId }));
    const entered = { ...before, draft: { ...before.draft, quantity: "12.5" } };
    const after = applyUnitSaveFailed(entered);
    expect(after.label).toBeNull();
    expect(bagSurface(after)).toBe("form");
    expect(after.draft).toEqual(entered.draft);
    expect(after.batch).toBe(entered.batch);
  });
});

describe("batch unit list", () => {
  const older = { ...bag, id: "older", createdAt: "2026-09-29T09:00:00.000Z" };
  const newer = { ...bag, id: "newer", createdAt: "2026-09-29T10:00:00.000Z" };

  it("uses the updated heading and keeps a dedicated empty state", () => {
    expect(UNCONFIRMED_BATCHES_HEADING).toBe("Nepatvirtintos partijos");
    expect(BATCH_UNITS_HEADING).toBe("Partijos maišai");
    expect(EMPTY_BATCH_UNITS_MESSAGE).toBe(
      "Šioje partijoje dar nėra užregistruotų maišų.",
    );
  });

  it("maps a unit to its compact operational row (no batch-level fields)", () => {
    expect(batchUnitRow(bag)).toEqual({
      id: bag.id,
      barcode: bag.barcode,
      locationName: "Stelažas A1",
      quantity: "25.5",
      unit: "KG",
      registeredAt: bag.createdAt,
    });
  });

  it("orders the units newest first", () => {
    const list = batchUnitsNewestFirst(detail({ bags: [older, newer] }));
    expect(list.map((item) => item.id)).toEqual(["newer", "older"]);
  });

  it("keeps a newly saved unit in the refreshed list", () => {
    const refreshed = detail({ bags: [older, newer] });
    const state = applyUnitSaved(refreshed, newer);
    expect(batchUnitsNewestFirst(state.batch as BatchDetail)).toContain(newer);
    expect(state.batch?.bags).toHaveLength(2);
  });

  it("reprint reuses the existing unit without creating a new one", () => {
    const state = enterBagMode(detail({ bags: [bag] }));
    const reprinted = openLabel(state, bag);
    expect(reprinted.label).toBe(bag);
    // No new unit and no draft/batch change (reprint only re-uses label data).
    expect(reprinted.batch).toBe(state.batch);
    expect(reprinted.batch?.bags).toHaveLength(1);
    expect(reprinted.draft).toEqual(state.draft);
    expect(bagLabelData(reprinted.batch as BatchDetail, bag)).toEqual(
      bagLabelData(state.batch as BatchDetail, bag),
    );
    expect(REPRINT_LABEL).toBe("Spausdinti");
  });
});

describe("save actions", () => {
  const locationId = "77777777-7777-4777-8777-777777777777";

  it("exposes the save-only and save-and-print labels", () => {
    expect(SAVE_LABEL).toBe("Išsaugoti");
    expect(SAVE_AND_PRINT_LABEL).toBe("Išsaugoti ir spausdinti");
  });

  it("save-and-print opens the label; save-only stays on the form", () => {
    const refreshed = detail({
      unit: "KG",
      suggestedLocationId: locationId,
      bags: [bag],
    });

    const printed = applyUnitSaved(refreshed, bag);
    expect(bagSurface(printed)).toBe("label");
    expect(printed.label).toBe(bag);

    const savedOnly = applyUnitSavedSilently(refreshed);
    expect(bagSurface(savedOnly)).toBe("form");
    expect(savedOnly.label).toBeNull();
  });

  it("both save paths preserve the batch and reset only the next quantity", () => {
    const refreshed = detail({
      unit: "PCS",
      suggestedLocationId: locationId,
      bags: [bag],
    });
    const nextDraft = {
      unit: "PCS",
      quantity: "",
      warehouseLocationId: locationId,
    };

    for (const state of [
      applyUnitSaved(refreshed, bag),
      applyUnitSavedSilently(refreshed),
    ]) {
      expect(state.batch).toBe(refreshed);
      expect(state.draft).toEqual(nextDraft);
    }
  });
});
