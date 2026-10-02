import { describe, expect, it } from "vitest";
import {
  BagCorrectionSchema,
  BagSchema,
  BagStatusSchema,
  BAG_STATUSES,
  BAG_STATUS_LABELS,
  BatchReconciliationSchema,
  BatchSchema,
  BatchStatusSchema,
  BATCH_STATUSES,
  BATCH_STATUS_LABELS,
  CreateBagRequestSchema,
  ReconcileBatchRequestSchema,
  UpdateBagRequestSchema,
  VoidBagRequestSchema,
} from "./batches";

const resourceId = "11111111-1111-4111-8111-111111111111";
const supplierId = "22222222-2222-4222-8222-222222222222";
const warehouseId = "33333333-3333-4333-8333-333333333333";
const locationId = "44444444-4444-4444-8444-444444444444";

describe("batch status", () => {
  it("maps every status to a Lithuanian label", () => {
    for (const status of BATCH_STATUSES) {
      expect(BATCH_STATUS_LABELS[status]).toBeTruthy();
    }
    expect(BATCH_STATUS_LABELS.PENDING).toBe("Laukiama patvirtinimo");
  });

  it("rejects an unknown status", () => {
    expect(BatchStatusSchema.safeParse("DRAFT").success).toBe(false);
  });
});

describe("BatchSchema", () => {
  function payload(overrides: Record<string, unknown> = {}) {
    return {
      id: resourceId,
      code: "P01",
      deliveryId: supplierId,
      deliveryCode: "G2609-01",
      resourceId,
      resourceName: "Cukrus",
      resourceCategoryName: "Žaliava",
      supplierId,
      supplierName: "Tiekėjas UAB",
      warehouseId,
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
      createdById: warehouseId,
      createdByName: "Vardenis Pavardenis",
      bagCount: 0,
      totalNetWeight: "0",
      createdAt: "2026-09-29T09:00:00.000Z",
      updatedAt: "2026-09-29T09:00:00.000Z",
      ...overrides,
    };
  }

  it("carries the delivery reference, warehouse and net-weight total (no unit)", () => {
    const parsed = BatchSchema.parse(payload());
    expect(parsed.deliveryCode).toBe("G2609-01");
    expect(parsed.warehouseName).toBe("Pagrindinis");
    expect(parsed.totalNetWeight).toBe("0");
    expect("unit" in parsed).toBe(false);
  });

  it("accepts an optional positive integer documentary piece count", () => {
    expect(BatchSchema.parse(payload({ documentPieces: 500 })).documentPieces).toBe(
      500,
    );
    expect(BatchSchema.safeParse(payload({ documentPieces: 0 })).success).toBe(
      false,
    );
    expect(BatchSchema.safeParse(payload({ documentPieces: 2.5 })).success).toBe(
      false,
    );
  });
});

describe("bag status", () => {
  it("maps every status to a Lithuanian label", () => {
    for (const status of BAG_STATUSES) {
      expect(BAG_STATUS_LABELS[status]).toBeTruthy();
    }
    expect(BAG_STATUS_LABELS.VOIDED).toBe("Anuliuotas");
  });

  it("rejects an unknown status", () => {
    expect(BagStatusSchema.safeParse("DELETED").success).toBe(false);
  });

  it("parses a gross/net package with packaging and void metadata", () => {
    const parsed = BagSchema.parse({
      id: resourceId,
      barcode: "1234567890123",
      batchId: supplierId,
      batchCode: "P01",
      packagingTypeId: resourceId,
      packagingTypeName: "EPAL",
      tareWeightKg: "27.000",
      grossWeight: "52.500",
      netWeight: "25.500",
      status: "VOIDED",
      warehouseLocationId: locationId,
      warehouseLocationName: "A-01",
      voidedById: warehouseId,
      voidedByName: "Vardenis Pavardenis",
      voidedAt: "2026-09-29T10:00:00.000Z",
      voidReason: "Įrašyta per klaidą",
      createdById: warehouseId,
      createdByName: "Vardenis Pavardenis",
      createdAt: "2026-09-29T09:00:00.000Z",
      updatedAt: "2026-09-29T10:00:00.000Z",
    });
    expect(parsed.netWeight).toBe("25.500");
    expect(parsed.grossWeight).toBe("52.500");
    expect(parsed.tareWeightKg).toBe("27.000");
    expect("unit" in parsed).toBe(false);
  });
});

describe("CreateBagRequestSchema", () => {
  const base = {
    packagingTypeId: resourceId,
    grossWeight: "25.5",
    warehouseLocationId: locationId,
  };

  it("accepts a packaging type, gross weight and warehouse location", () => {
    expect(CreateBagRequestSchema.safeParse(base).success).toBe(true);
  });

  it("requires a valid warehouse location with a friendly message", () => {
    const missing = CreateBagRequestSchema.safeParse({
      packagingTypeId: resourceId,
      grossWeight: "10",
    });
    expect(missing.success).toBe(false);
    if (!missing.success) {
      expect(
        missing.error.issues.some(
          (issue) =>
            issue.path[0] === "warehouseLocationId" &&
            issue.message === "Pasirinkite sandėlio vietą.",
        ),
      ).toBe(true);
    }
    expect(
      CreateBagRequestSchema.safeParse({ ...base, packagingTypeId: "x" })
        .success,
    ).toBe(false);
  });

  it("rejects zero, negative and non-numeric gross weights", () => {
    for (const grossWeight of ["0", "0.0", "-1", "abc", ""]) {
      expect(
        CreateBagRequestSchema.safeParse({ ...base, grossWeight }).success,
      ).toBe(false);
    }
  });

  it("rejects unknown fields (no unit, no barcode)", () => {
    expect(
      CreateBagRequestSchema.safeParse({ ...base, unit: "KG" }).success,
    ).toBe(false);
    expect(
      CreateBagRequestSchema.safeParse({ ...base, barcode: "123" }).success,
    ).toBe(false);
  });
});

describe("UpdateBagRequestSchema", () => {
  it("accepts a packaging-only, gross-only or location-only update", () => {
    expect(
      UpdateBagRequestSchema.safeParse({ packagingTypeId: resourceId }).success,
    ).toBe(true);
    expect(UpdateBagRequestSchema.safeParse({ grossWeight: "30" }).success).toBe(
      true,
    );
    expect(
      UpdateBagRequestSchema.safeParse({ warehouseLocationId: locationId })
        .success,
    ).toBe(true);
  });

  it("requires at least one field and rejects a non-positive gross weight", () => {
    expect(UpdateBagRequestSchema.safeParse({}).success).toBe(false);
    expect(UpdateBagRequestSchema.safeParse({ grossWeight: "0" }).success).toBe(
      false,
    );
  });
});

describe("VoidBagRequestSchema", () => {
  it("accepts an empty body or an optional reason", () => {
    expect(VoidBagRequestSchema.safeParse({}).success).toBe(true);
    expect(VoidBagRequestSchema.safeParse({ reason: "Sugedęs maišas" }).success).toBe(
      true,
    );
  });

  it("rejects an over-long reason and unknown fields", () => {
    expect(
      VoidBagRequestSchema.safeParse({ reason: "x".repeat(501) }).success,
    ).toBe(false);
  });
});

describe("BagCorrectionSchema", () => {
  it("parses a gross-weight correction with its audit fields", () => {
    const parsed = BagCorrectionSchema.parse({
      id: resourceId,
      bagId: supplierId,
      bagBarcode: "1234567890123",
      kind: "GROSS_WEIGHT",
      previousValue: "25.5",
      newValue: "30",
      reason: null,
      createdById: warehouseId,
      createdByName: "Vardenis Pavardenis",
      createdAt: "2026-09-29T10:00:00.000Z",
    });
    expect(parsed.kind).toBe("GROSS_WEIGHT");
    expect(parsed.newValue).toBe("30");
  });
});

const receiptLineId = "55555555-5555-4555-8555-555555555555";

describe("ReconcileBatchRequestSchema", () => {
  function payload(overrides: Record<string, unknown> = {}) {
    return {
      documentWeight: "4987.65",
      acquisitionAmount: "12000",
      ...overrides,
    };
  }

  it("accepts a valid reconciliation request with optional pieces", () => {
    expect(ReconcileBatchRequestSchema.safeParse(payload()).success).toBe(true);
    expect(
      ReconcileBatchRequestSchema.safeParse(payload({ documentPieces: 500 }))
        .success,
    ).toBe(true);
  });

  it("rejects a non-positive, fractional or non-numeric piece count", () => {
    for (const documentPieces of [0, -1, 2.5, "500"]) {
      expect(
        ReconcileBatchRequestSchema.safeParse(payload({ documentPieces })).success,
      ).toBe(false);
    }
  });

  it("does not accept a technical receipt-line selector or measured weight", () => {
    expect(
      ReconcileBatchRequestSchema.safeParse(payload({ receiptLineId })).success,
    ).toBe(false);
    expect(
      ReconcileBatchRequestSchema.safeParse(payload({ measuredWeight: "1" }))
        .success,
    ).toBe(false);
  });

  it("rejects a non-positive document weight", () => {
    for (const documentWeight of ["0", "-1", "abc", ""]) {
      expect(
        ReconcileBatchRequestSchema.safeParse(payload({ documentWeight })).success,
      ).toBe(false);
    }
  });
});

describe("BatchReconciliationSchema", () => {
  it("parses a confirmed summary with a signed discrepancy and optional pieces", () => {
    const parsed = BatchReconciliationSchema.parse({
      batchId: resourceId,
      code: "P01",
      status: "CONFIRMED",
      bagCount: 3,
      measuredWeight: "4980",
      documentWeight: "4987.65",
      documentPieces: 500,
      // measured − document
      difference: "-7.65",
      discrepancyId: receiptLineId,
      acquisitionAmount: "12000",
      receiptId: warehouseId,
      receiptLineId,
      documentDate: null,
      documentNumber: null,
      confirmedAt: "2026-09-29T10:00:00.000Z",
    });
    expect(parsed.status).toBe("CONFIRMED");
    expect(parsed.documentPieces).toBe(500);
    expect(parsed.difference).toBe("-7.65");
    expect(parsed.discrepancyId).toBe(receiptLineId);
  });
});
