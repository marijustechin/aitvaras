import { describe, expect, it } from "vitest";
import {
  BagCorrectionSchema,
  BagSchema,
  BagStatusSchema,
  BAG_STATUSES,
  BAG_STATUS_LABELS,
  BatchReconciliationSchema,
  BatchStatusSchema,
  BATCH_STATUSES,
  BATCH_STATUS_LABELS,
  CreateBagRequestSchema,
  CreateBatchRequestSchema,
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

describe("CreateBatchRequestSchema", () => {
  it("accepts a valid batch request", () => {
    expect(
      CreateBatchRequestSchema.safeParse({
        resourceId,
        supplierId,
        warehouseId,
        arrivalDate: "2026-09-29T00:00:00.000Z",
      }).success,
    ).toBe(true);
  });

  it("rejects missing ids and a non-ISO arrival date", () => {
    expect(
      CreateBatchRequestSchema.safeParse({
        resourceId,
        supplierId,
        arrivalDate: "2026-09-29T00:00:00.000Z",
      }).success,
    ).toBe(false);
    expect(
      CreateBatchRequestSchema.safeParse({
        resourceId: "not-a-uuid",
        supplierId,
        warehouseId,
        arrivalDate: "2026-09-29T00:00:00.000Z",
      }).success,
    ).toBe(false);
    expect(
      CreateBatchRequestSchema.safeParse({
        resourceId,
        supplierId,
        warehouseId,
        arrivalDate: "2026-09-29",
      }).success,
    ).toBe(false);
  });

  it("rejects unknown fields", () => {
    expect(
      CreateBatchRequestSchema.safeParse({
        resourceId,
        supplierId,
        warehouseId,
        arrivalDate: "2026-09-29T00:00:00.000Z",
        status: "CONFIRMED",
      }).success,
    ).toBe(false);
  });
});

describe("CreateBagRequestSchema", () => {
  const base = {
    quantity: "25.5",
    unit: "KG",
    warehouseLocationId: locationId,
  };

  it("defaults the unit to KG and accepts a decimal KG quantity", () => {
    expect(
      CreateBagRequestSchema.parse({
        quantity: "25.5",
        warehouseLocationId: locationId,
      }).unit,
    ).toBe("KG");
    expect(CreateBagRequestSchema.safeParse(base).success).toBe(true);
  });

  it("accepts a whole PCS quantity", () => {
    expect(
      CreateBagRequestSchema.safeParse({
        ...base,
        unit: "PCS",
        quantity: "12",
      }).success,
    ).toBe(true);
  });

  it("rejects a fractional PCS quantity", () => {
    expect(
      CreateBagRequestSchema.safeParse({
        ...base,
        unit: "PCS",
        quantity: "12.5",
      }).success,
    ).toBe(false);
  });

  it("requires a valid warehouse location with a friendly message", () => {
    const missing = CreateBagRequestSchema.safeParse({
      quantity: "10",
      unit: "KG",
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
      CreateBagRequestSchema.safeParse({ ...base, warehouseLocationId: "" })
        .success,
    ).toBe(false);
    expect(
      CreateBagRequestSchema.safeParse({
        ...base,
        warehouseLocationId: "not-a-uuid",
      }).success,
    ).toBe(false);
  });

  it("rejects zero, negative and non-decimal quantities", () => {
    for (const quantity of ["0", "0.0", "-1", "abc", ""]) {
      expect(
        CreateBagRequestSchema.safeParse({ ...base, quantity }).success,
      ).toBe(false);
    }
  });

  it("rejects unknown fields", () => {
    expect(
      CreateBagRequestSchema.safeParse({ ...base, barcode: "123" }).success,
    ).toBe(false);
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

  it("parses a voided unit with its void metadata", () => {
    const parsed = BagSchema.parse({
      id: resourceId,
      barcode: "1234567890123",
      batchId: supplierId,
      batchCode: "P-2026-000001",
      quantity: "25.5",
      unit: "KG",
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
    expect(parsed.status).toBe("VOIDED");
    expect(parsed.voidReason).toBe("Įrašyta per klaidą");
  });
});

describe("UpdateBagRequestSchema", () => {
  it("accepts a quantity-only, location-only or combined update", () => {
    expect(UpdateBagRequestSchema.safeParse({ quantity: "30" }).success).toBe(
      true,
    );
    expect(
      UpdateBagRequestSchema.safeParse({ warehouseLocationId: locationId })
        .success,
    ).toBe(true);
    expect(
      UpdateBagRequestSchema.safeParse({
        quantity: "30",
        warehouseLocationId: locationId,
      }).success,
    ).toBe(true);
  });

  it("requires at least one field to correct", () => {
    expect(UpdateBagRequestSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a non-positive quantity, a bad location and unknown fields", () => {
    expect(UpdateBagRequestSchema.safeParse({ quantity: "0" }).success).toBe(
      false,
    );
    expect(
      UpdateBagRequestSchema.safeParse({ warehouseLocationId: "not-a-uuid" })
        .success,
    ).toBe(false);
    expect(
      UpdateBagRequestSchema.safeParse({ quantity: "5", status: "VOIDED" })
        .success,
    ).toBe(false);
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
    expect(VoidBagRequestSchema.safeParse({ quantity: "5" }).success).toBe(false);
  });
});

describe("BagCorrectionSchema", () => {
  it("parses a quantity correction with its audit fields", () => {
    const parsed = BagCorrectionSchema.parse({
      id: resourceId,
      bagId: supplierId,
      bagBarcode: "1234567890123",
      kind: "QUANTITY",
      previousValue: "25.5",
      newValue: "30",
      reason: null,
      createdById: warehouseId,
      createdByName: "Vardenis Pavardenis",
      createdAt: "2026-09-29T10:00:00.000Z",
    });
    expect(parsed.kind).toBe("QUANTITY");
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

  it("accepts a valid reconciliation request", () => {
    expect(ReconcileBatchRequestSchema.safeParse(payload()).success).toBe(true);
    expect(
      ReconcileBatchRequestSchema.safeParse(
        payload({ acquisitionAmount: "0", documentWeight: "1" }),
      ).success,
    ).toBe(true);
  });

  it("accepts optional document date and number", () => {
    const parsed = ReconcileBatchRequestSchema.parse(
      payload({
        documentDate: "2026-09-29T00:00:00.000Z",
        documentNumber: "SF-123",
      }),
    );
    expect(parsed.documentDate).toBe("2026-09-29T00:00:00.000Z");
    expect(parsed.documentNumber).toBe("SF-123");
  });

  it("does not accept a technical receipt-line selector", () => {
    // The internal receipt line is resolved server-side; the client must not —
    // and cannot — send it.
    expect(
      ReconcileBatchRequestSchema.safeParse(payload({ receiptLineId })).success,
    ).toBe(false);
  });

  it("rejects a non-positive document weight", () => {
    for (const documentWeight of ["0", "-1", "abc", ""]) {
      expect(
        ReconcileBatchRequestSchema.safeParse(payload({ documentWeight })).success,
      ).toBe(false);
    }
  });

  it("rejects a negative or non-numeric acquisition amount", () => {
    for (const acquisitionAmount of ["-1", "abc", ""]) {
      expect(
        ReconcileBatchRequestSchema.safeParse(payload({ acquisitionAmount }))
          .success,
      ).toBe(false);
    }
  });

  it("rejects a bad document date, an over-long number and unknown fields", () => {
    expect(
      ReconcileBatchRequestSchema.safeParse(payload({ documentDate: "2026-09-29" }))
        .success,
    ).toBe(false);
    expect(
      ReconcileBatchRequestSchema.safeParse(
        payload({ documentNumber: "x".repeat(65) }),
      ).success,
    ).toBe(false);
    expect(
      ReconcileBatchRequestSchema.safeParse(payload({ measuredWeight: "1" })).success,
    ).toBe(false);
  });
});

describe("BatchReconciliationSchema", () => {
  it("parses a discrepancy summary", () => {
    const parsed = BatchReconciliationSchema.parse({
      batchId: resourceId,
      code: "P-2026-000001",
      status: "DISCREPANCY",
      bagCount: 3,
      measuredWeight: "4980",
      documentWeight: "4987.65",
      difference: "7.65",
      acquisitionAmount: "12000",
      receiptId: warehouseId,
      receiptLineId,
      documentDate: null,
      documentNumber: null,
      confirmedAt: null,
    });
    expect(parsed.status).toBe("DISCREPANCY");
    expect(parsed.difference).toBe("7.65");
    expect(parsed.confirmedAt).toBeNull();
  });
});
