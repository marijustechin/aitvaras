import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type {
  Bag,
  Batch,
  BatchDetail,
  IncomingDeliveryDetail,
} from "@aitvaras/contracts";
import {
  activeBatchUnits,
  ANOTHER_RESOURCE_LABEL,
  applyUnitSaveFailed,
  applyUnitSaved,
  applyUnitSavedSilently,
  BAG_RECEIVING_FIELDS,
  BAG_SURFACES,
  bagLabelData,
  bagSurface,
  batchUnitRow,
  batchUnitsNewestFirst,
  BATCH_UNITS_HEADING,
  closeLabel,
  CORRECT_LABEL,
  DELIVERIES_LIST_BACK_LABEL,
  DELIVERY_CONTENTS_HEADING,
  DELIVERY_CONTEXT_FIELDS,
  deliveryBatches,
  EMPTY_BATCH_UNITS_MESSAGE,
  EMPTY_DELIVERIES_MESSAGE,
  EMPTY_DELIVERY_CONTENTS_MESSAGE,
  enterBatch,
  enterDelivery,
  FORMAL_RECONCILIATION_FIELDS,
  initialReceivingState,
  NEW_DELIVERY_LABEL,
  openLabel,
  openReceivingDeliveries,
  OPEN_DELIVERIES_HEADING,
  REPRINT_LABEL,
  RESOURCE_HEADING,
  RESOURCE_SELECTION_FIELDS,
  SAVE_AND_PRINT_LABEL,
  SAVE_LABEL,
  START_DELIVERY_LABEL,
  START_RESOURCE_LABEL,
  startAnotherResource,
  VOID_CONFIRM_LABEL,
  VOID_LABEL,
  VOIDED_UNITS_HEADING,
  voidedBatchUnits,
} from "./receiving";

const DELIVERY_ID = "11111111-1111-4111-8111-111111111111";
const BATCH_ID = "22222222-2222-4222-8222-222222222222";
const RESOURCE_ID = "33333333-3333-4333-8333-333333333333";
const WAREHOUSE_ID = "66666666-6666-4666-8666-666666666666";
const LOCATION_ID = "44444444-4444-4444-8444-444444444444";

function batch(overrides: Partial<Batch> = {}): Batch {
  return {
    id: BATCH_ID,
    code: "P01",
    deliveryId: DELIVERY_ID,
    deliveryCode: "G2609-01",
    resourceId: RESOURCE_ID,
    resourceName: "Cukrus",
    resourceCategoryName: "Žaliava",
    supplierId: "55555555-5555-4555-8555-555555555555",
    supplierName: "Tiekėjas UAB",
    warehouseId: WAREHOUSE_ID,
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
    createdById: "77777777-7777-4777-8777-777777777777",
    createdByName: "Vardas Pavardė",
    bagCount: 2,
    totalNetWeight: "19.75",
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
    discrepancies: [],
    suggestedLocationId: null,
    suggestedPackagingTypeId: null,
    ...overrides,
  };
}

function delivery(
  overrides: Partial<IncomingDeliveryDetail> = {},
): IncomingDeliveryDetail {
  return {
    id: DELIVERY_ID,
    code: "G2609-01",
    supplierId: "55555555-5555-4555-8555-555555555555",
    supplierName: "Tiekėjas UAB",
    arrivalDate: "2026-09-29T00:00:00.000Z",
    createdById: "77777777-7777-4777-8777-777777777777",
    createdByName: "Vardas Pavardė",
    batchCount: 1,
    pendingBatchCount: 1,
    batches: [batch()],
    createdAt: "2026-09-29T09:00:00.000Z",
    updatedAt: "2026-09-29T09:00:00.000Z",
    ...overrides,
  };
}

const bag: Bag = {
  id: "88888888-8888-4888-8888-888888888888",
  barcode: "2012345678903",
  batchId: BATCH_ID,
  batchCode: "P01",
  packagingTypeId: "99999999-9999-4999-8999-999999999999",
  packagingTypeName: "EPAL",
  tareWeightKg: "27.000",
  grossWeight: "52.500",
  netWeight: "25.500",
  status: "ACTIVE",
  warehouseLocationId: LOCATION_ID,
  warehouseLocationName: "Stelažas A1",
  voidedById: null,
  voidedByName: null,
  voidedAt: null,
  voidReason: null,
  createdById: "77777777-7777-4777-8777-777777777777",
  createdByName: "Vardas Pavardė",
  createdAt: "2026-09-29T09:05:00.000Z",
  updatedAt: "2026-09-29T09:05:00.000Z",
};

describe("receiving modes and labels", () => {
  it("exposes the delivery-centric labels", () => {
    expect(NEW_DELIVERY_LABEL).toBe("Naujas gavimas");
    expect(START_DELIVERY_LABEL).toBe("Pradėti gavimą");
    expect(OPEN_DELIVERIES_HEADING).toBe("Nepatvirtinti gavimai");
    expect(EMPTY_DELIVERIES_MESSAGE).toBe("Nėra gavimų.");
    expect(RESOURCE_HEADING).toBe("Registruojama rūšis");
    expect(START_RESOURCE_LABEL).toBe("Pradėti registruoti");
    expect(ANOTHER_RESOURCE_LABEL).toBe("Kitas išteklius");
    expect(DELIVERY_CONTENTS_HEADING).toBe("Gavimo turinys");
    expect(EMPTY_DELIVERY_CONTENTS_MESSAGE).toBe(
      "Šiame gavime dar nėra užregistruotų išteklių.",
    );
    expect(SAVE_LABEL).toBe("Išsaugoti");
    expect(SAVE_AND_PRINT_LABEL).toBe("Išsaugoti ir spausdinti");
    expect(CORRECT_LABEL).toBe("Taisyti");
    expect(VOID_LABEL).toBe("Anuliuoti");
    expect(REPRINT_LABEL).toBe("Spausdinti");
    expect(VOID_CONFIRM_LABEL).toBe("Anuliuoti pakuotę");
    expect(VOIDED_UNITS_HEADING).toBe("Anuliuotos pakuotės");
  });
});

describe("deliveryBatches", () => {
  it("orders the internal batches by registration time", () => {
    const older = batch({ id: "older", createdAt: "2026-09-29T09:00:00.000Z" });
    const newer = batch({ id: "newer", createdAt: "2026-09-29T10:00:00.000Z" });
    const list = deliveryBatches(delivery({ batches: [newer, older] }));
    expect(list.map((item) => item.id)).toEqual(["older", "newer"]);
  });
});

describe("bagLabelData", () => {
  it("uses the delivery code prominently and carries the weight metadata", () => {
    const label = bagLabelData(delivery(), batch(), bag);
    expect(label.deliveryCode).toBe("G2609-01");
    expect(label.warehouseName).toBe("Pagrindinis");
    expect(label.locationName).toBe("Stelažas A1");
    expect(label.categoryName).toBe("Žaliava");
    expect(label.resourceName).toBe("Cukrus");
    expect(label.tareWeightKg).toBe("27.000");
    expect(label.grossWeight).toBe("52.500");
    expect(label.netWeight).toBe("25.500");
    expect(label.barcode).toBe("2012345678903");
  });
});

describe("field separation", () => {
  it("exposes packaging + location + gross weight to start", () => {
    expect([...BAG_RECEIVING_FIELDS]).toEqual([
      "packagingTypeId",
      "warehouseLocationId",
      "grossWeight",
    ]);
    expect([...RESOURCE_SELECTION_FIELDS]).toEqual(["resourceId", "warehouseId"]);
  });

  it("keeps formal reconciliation fields out of the worker flow", () => {
    for (const field of FORMAL_RECONCILIATION_FIELDS) {
      expect(BAG_RECEIVING_FIELDS as readonly string[]).not.toContain(field);
      expect(RESOURCE_SELECTION_FIELDS as readonly string[]).not.toContain(field);
      expect(DELIVERY_CONTEXT_FIELDS as readonly string[]).not.toContain(field);
    }
  });

  it("exposes the delivery context the worker sees (no warehouse)", () => {
    expect([...DELIVERY_CONTEXT_FIELDS]).toEqual([
      "code",
      "supplierName",
      "arrivalDate",
      "batchCount",
    ]);
  });
});

describe("receiving state", () => {
  it("starts on the entry form with no delivery", () => {
    const state = initialReceivingState();
    expect(state.delivery).toBeNull();
    expect(state.batch).toBeNull();
    expect(state.label).toBeNull();
    expect(bagSurface(state)).toBe("form");
  });

  it("has only form and label surfaces (no intermediate detail)", () => {
    expect([...BAG_SURFACES]).toEqual(["form", "label"]);
    expect(BAG_SURFACES as readonly string[]).not.toContain("detail");
  });

  it("entering a delivery clears the batch/resource selection", () => {
    const state = enterDelivery(delivery());
    expect(state.delivery).not.toBeNull();
    expect(state.batch).toBeNull();
    expect(state.resource).toEqual({ resourceId: "", warehouseId: "" });
    expect(state.label).toBeNull();
  });

  it("entering a batch locks the resource/warehouse and suggests the location", () => {
    const started = enterDelivery(delivery());
    const state = enterBatch(
      started,
      detail({ suggestedLocationId: LOCATION_ID }),
    );
    expect(state.batch?.warehouseId).toBe(WAREHOUSE_ID);
    expect(state.resource).toEqual({
      resourceId: RESOURCE_ID,
      warehouseId: WAREHOUSE_ID,
    });
    expect(state.draft).toEqual({
      packagingTypeId: "",
      grossWeight: "",
      warehouseLocationId: LOCATION_ID,
    });
  });

  it("suggests the latest active package's packaging type and location", () => {
    const state = enterBatch(
      enterDelivery(delivery()),
      detail({
        suggestedLocationId: LOCATION_ID,
        suggestedPackagingTypeId: "tara-x",
      }),
    );
    expect(state.draft).toEqual({
      packagingTypeId: "tara-x",
      grossWeight: "",
      warehouseLocationId: LOCATION_ID,
    });
  });

  it("after a save keeps the suggested packaging type and clears only the gross weight", () => {
    const state = applyUnitSaved(
      enterDelivery(delivery()),
      detail({
        suggestedLocationId: LOCATION_ID,
        suggestedPackagingTypeId: "tara-x",
      }),
      bag,
    );
    expect(state.draft).toEqual({
      packagingTypeId: "tara-x",
      grossWeight: "",
      warehouseLocationId: LOCATION_ID,
    });
    expect(bag.tareWeightKg).toBe("27.000");
  });

  it("starts another resource while keeping the delivery open", () => {
    const state = startAnotherResource(
      enterBatch(
        enterDelivery(delivery()),
        detail({ suggestedPackagingTypeId: "tara-x" }),
      ),
    );
    expect(state.delivery).not.toBeNull();
    expect(state.batch).toBeNull();
    expect(state.resource).toEqual({ resourceId: "", warehouseId: "" });
    // A new batch does not inherit the previous batch's packaging type.
    expect(state.draft.packagingTypeId).toBe("");
  });

  it("a successful save goes straight to the label (no detail state)", () => {
    const state = applyUnitSaved(
      enterDelivery(delivery()),
      detail({ suggestedLocationId: LOCATION_ID }),
      bag,
    );
    expect(bagSurface(state)).toBe("label");
    expect(state.label).toBe(bag);
    expect(state.draft).toEqual({
      packagingTypeId: "",
      grossWeight: "",
      warehouseLocationId: LOCATION_ID,
    });
  });

  it("save-only stays on the form; closing the label returns to it", () => {
    const savedOnly = applyUnitSavedSilently(enterDelivery(delivery()), detail());
    expect(bagSurface(savedOnly)).toBe("form");
    expect(savedOnly.label).toBeNull();

    const printed = applyUnitSaved(enterDelivery(delivery()), detail(), bag);
    const closed = closeLabel(printed);
    expect(bagSurface(closed)).toBe("form");
    expect(closed.label).toBeNull();
    expect(closed.batch).toBe(printed.batch);
  });

  it("a failed save never opens the label and keeps the draft", () => {
    const started = enterBatch(enterDelivery(delivery()), detail());
    const entered = {
      ...started,
      draft: { ...started.draft, grossWeight: "12.5" },
    };
    const after = applyUnitSaveFailed(entered);
    expect(after.label).toBeNull();
    expect(after.draft).toEqual(entered.draft);
  });
});

describe("batch unit list", () => {
  const older = { ...bag, id: "older", createdAt: "2026-09-29T09:00:00.000Z" };
  const newer = { ...bag, id: "newer", createdAt: "2026-09-29T10:00:00.000Z" };
  const voided = {
    ...bag,
    id: "voided",
    createdAt: "2026-09-29T11:00:00.000Z",
    status: "VOIDED" as const,
    voidedByName: "Vardas Pavardė",
    voidedAt: "2026-09-29T11:00:00.000Z",
    voidReason: "Sugedęs",
  };

  it("uses the package-list heading and a dedicated empty state", () => {
    expect(BATCH_UNITS_HEADING).toBe("Partijos pakuotės");
    expect(EMPTY_BATCH_UNITS_MESSAGE).toBe(
      "Šioje partijoje dar nėra užregistruotų pakuočių.",
    );
  });

  it("maps a package to its compact operational row (net weight)", () => {
    expect(batchUnitRow(bag)).toEqual({
      id: bag.id,
      barcode: bag.barcode,
      locationName: "Stelažas A1",
      netWeight: "25.500",
      registeredAt: bag.createdAt,
    });
  });

  it("orders newest first and splits active/voided", () => {
    const list = detail({ bags: [older, voided, newer] });
    expect(batchUnitsNewestFirst(list).map((item) => item.id)).toEqual([
      "voided",
      "newer",
      "older",
    ]);
    expect(activeBatchUnits(list).map((item) => item.id)).toEqual([
      "newer",
      "older",
    ]);
    expect(voidedBatchUnits(list).map((item) => item.id)).toEqual(["voided"]);
  });

  it("reprint reuses the existing package without creating a new one", () => {
    const state = enterBatch(enterDelivery(delivery()), detail({ bags: [bag] }));
    const reprinted = openLabel(state, bag);
    expect(reprinted.label).toBe(bag);
    expect(reprinted.batch).toBe(state.batch);
    expect(reprinted.batch?.bags).toHaveLength(1);
    expect(reprinted.draft).toEqual(state.draft);
  });
});

describe("openReceivingDeliveries — warehouse open queue", () => {
  it("shows a delivery while it still has a pending batch", () => {
    const pending = delivery({ batchCount: 2, pendingBatchCount: 1 });
    expect(openReceivingDeliveries([pending])).toHaveLength(1);
  });

  it("keeps a just-created delivery with no batches yet", () => {
    const empty = delivery({ batchCount: 0, pendingBatchCount: 0, batches: [] });
    expect(openReceivingDeliveries([empty])).toHaveLength(1);
  });

  it("hides a delivery whose batches are all confirmed", () => {
    const confirmed = delivery({ batchCount: 2, pendingBatchCount: 0 });
    expect(openReceivingDeliveries([confirmed])).toEqual([]);
  });

  it("keeps a mixed confirmed/pending delivery in the queue", () => {
    const mixed = delivery({ batchCount: 3, pendingBatchCount: 2 });
    const closed = delivery({
      id: "other",
      batchCount: 1,
      pendingBatchCount: 0,
    });
    expect(openReceivingDeliveries([mixed, closed]).map((d) => d.id)).toEqual([
      DELIVERY_ID,
    ]);
  });
});

describe("receiving routes and navigation (source)", () => {
  const srcRoot = fileURLToPath(new URL("../../../", import.meta.url));
  const listSource = readFileSync(
    fileURLToPath(new URL("../ui/receiving-page.tsx", import.meta.url)),
    "utf8",
  );
  const detailSource = readFileSync(
    fileURLToPath(new URL("../ui/receiving-delivery.tsx", import.meta.url)),
    "utf8",
  );
  const listRoute = readFileSync(
    join(srcRoot, "app", "receiving", "page.tsx"),
    "utf8",
  );
  const detailRoute = readFileSync(
    join(srcRoot, "app", "receiving", "[deliveryId]", "page.tsx"),
    "utf8",
  );

  it("keeps /receiving as the list and gives a delivery its own route", () => {
    expect(listRoute).toContain("ReceivingPage");
    expect(detailRoute).toContain("ReceivingDeliveryPage");
  });

  it("navigates to a selected/created delivery instead of ephemeral state", () => {
    expect(listSource).toContain("router.push(`/receiving/${created.id}`)");
    expect(listSource).toContain("router.push(`/receiving/${item.id}`)");
    expect(listSource).not.toContain('setMode("bag")');
    expect(listSource).not.toContain("window.location");
  });

  it("offers a Gavimų sąrašas back action that returns to the list", () => {
    expect(DELIVERIES_LIST_BACK_LABEL).toBe("← Gavimų sąrašas");
    expect(detailSource).toContain("DELIVERIES_LIST_BACK_LABEL");
    expect(detailSource).toContain('href="/receiving"');
    expect(detailSource).not.toContain("Kitas gavimas");
    expect(detailSource).not.toContain("window.location");
  });
});

describe("receiving page terminology (source)", () => {
  const source = readFileSync(
    fileURLToPath(new URL("../ui/receiving-delivery.tsx", import.meta.url)),
    "utf8",
  );

  it("uses generic Pakuotė wording, not bag-specific Maišas, in the active flow", () => {
    expect(source).toContain("Nauja pakuotė");
    expect(source).toContain("Koreguoti pakuotę");
    expect(source).not.toMatch(/[Mm]aiš/);
  });

  it("keeps Tara as the packaging selector label", () => {
    expect(source).toContain("Tara");
  });
});
