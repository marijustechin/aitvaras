import { describe, expect, it } from "vitest";
import {
  BATCH_RECEIVING_MODE_LABELS,
  BatchSchema,
  ConfirmPieceBatchRequestSchema,
  CreateBatchItemRequestSchema,
  UpdateBatchItemRequestSchema,
} from "./batches";
import { ResolveBatchRequestSchema } from "./incoming-deliveries";
import { QuickCreateResourceRequestSchema } from "./resources";

const UUID = "11111111-1111-4111-8111-111111111111";

describe("batch receiving mode", () => {
  it("exposes Lithuanian labels", () => {
    expect(BATCH_RECEIVING_MODE_LABELS.WEIGHT).toBe("Svorinė");
    expect(BATCH_RECEIVING_MODE_LABELS.PIECE).toBe("Vienetinė");
  });

  it("accepts a PIECE batch without a batch-level resource", () => {
    const parsed = BatchSchema.parse({
      id: UUID,
      code: "P01",
      deliveryId: UUID,
      deliveryCode: "G2610-01",
      receivingMode: "PIECE",
      resourceId: null,
      resourceName: null,
      resourceCategoryName: null,
      supplierId: UUID,
      supplierName: "Tiekėjas",
      warehouseId: UUID,
      warehouseName: "Sandėlis",
      arrivalDate: "2026-10-02T00:00:00.000Z",
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
      createdById: UUID,
      createdByName: "Vardas Pavardė",
      bagCount: 0,
      totalNetWeight: "0",
      itemLineCount: 3,
      totalPieces: 160,
      createdAt: "2026-10-02T00:00:00.000Z",
      updatedAt: "2026-10-02T00:00:00.000Z",
    });
    expect(parsed.itemLineCount).toBe(3);
    expect(parsed.resourceId).toBeNull();
  });
});

describe("ResolveBatchRequestSchema", () => {
  it("defaults to a WEIGHT batch with a resource", () => {
    expect(
      ResolveBatchRequestSchema.safeParse({ resourceId: UUID, warehouseId: UUID })
        .success,
    ).toBe(true);
    expect(
      ResolveBatchRequestSchema.safeParse({ receivingMode: "PIECE", warehouseId: UUID })
        .success,
    ).toBe(true);
  });

  it("rejects unknown fields", () => {
    expect(
      ResolveBatchRequestSchema.safeParse({ warehouseId: UUID, extra: 1 }).success,
    ).toBe(false);
  });
});

describe("CreateBatchItemRequestSchema", () => {
  it("requires a resource, a location and a positive integer quantity", () => {
    expect(
      CreateBatchItemRequestSchema.safeParse({
        resourceId: UUID,
        warehouseLocationId: UUID,
        quantity: 120,
      }).success,
    ).toBe(true);
    for (const quantity of [0, -1, 1.5]) {
      expect(
        CreateBatchItemRequestSchema.safeParse({
          resourceId: UUID,
          warehouseLocationId: UUID,
          quantity,
        }).success,
      ).toBe(false);
    }
  });
});

describe("UpdateBatchItemRequestSchema", () => {
  it("requires at least one change", () => {
    expect(UpdateBatchItemRequestSchema.safeParse({}).success).toBe(false);
    expect(UpdateBatchItemRequestSchema.safeParse({ quantity: 5 }).success).toBe(
      true,
    );
  });
});

describe("ConfirmPieceBatchRequestSchema", () => {
  it("requires an acquisition amount and per-product document quantities", () => {
    expect(
      ConfirmPieceBatchRequestSchema.safeParse({
        acquisitionAmount: "1250.50",
        products: [{ resourceId: UUID, documentPieces: 65 }],
      }).success,
    ).toBe(true);
    expect(
      ConfirmPieceBatchRequestSchema.safeParse({
        acquisitionAmount: "10",
        documentNumber: "SF-1",
        acknowledgeDiscrepancies: true,
        products: [{ resourceId: UUID, documentPieces: 100 }],
      }).success,
    ).toBe(true);
    // Missing products or a negative/non-integer document quantity is rejected.
    expect(
      ConfirmPieceBatchRequestSchema.safeParse({ acquisitionAmount: "10" })
        .success,
    ).toBe(false);
    expect(
      ConfirmPieceBatchRequestSchema.safeParse({
        acquisitionAmount: "10",
        products: [{ resourceId: UUID, documentPieces: -1 }],
      }).success,
    ).toBe(false);
    expect(ConfirmPieceBatchRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe("QuickCreateResourceRequestSchema", () => {
  it("is the minimal name + category form", () => {
    expect(
      QuickCreateResourceRequestSchema.safeParse({
        name: "Siurblys",
        categoryId: UUID,
      }).success,
    ).toBe(true);
    // Broad resource administration fields are not part of quick-create.
    expect(
      QuickCreateResourceRequestSchema.safeParse({
        name: "Siurblys",
        categoryId: UUID,
        notes: "x",
        active: false,
      }).success,
    ).toBe(false);
  });
});
