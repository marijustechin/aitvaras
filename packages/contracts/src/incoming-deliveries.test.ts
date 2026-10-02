import { describe, expect, it } from "vitest";
import {
  CreateIncomingDeliveryRequestSchema,
  IncomingDeliveryDetailSchema,
  IncomingDeliverySchema,
  ResolveBatchRequestSchema,
} from "./incoming-deliveries";
import { BatchSchema } from "./batches";

const deliveryId = "11111111-1111-4111-8111-111111111111";
const supplierId = "22222222-2222-4222-8222-222222222222";
const warehouseId = "33333333-3333-4333-8333-333333333333";
const resourceId = "44444444-4444-4444-8444-444444444444";
const userId = "55555555-5555-4555-8555-555555555555";

function batchPayload() {
  return BatchSchema.parse({
    id: resourceId,
    code: "P01",
    deliveryId,
    deliveryCode: "G2609-02",
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
    createdById: userId,
    createdByName: "Vardenis Pavardenis",
    bagCount: 0,
    totalNetWeight: "0",
    createdAt: "2026-09-29T09:00:00.000Z",
    updatedAt: "2026-09-29T09:00:00.000Z",
  });
}

describe("IncomingDeliverySchema", () => {
  it("parses a delivery with its human-facing code and no warehouse", () => {
    const parsed = IncomingDeliverySchema.parse({
      id: deliveryId,
      code: "G2609-01",
      supplierId,
      supplierName: "Tiekėjas UAB",
      arrivalDate: "2026-09-29T00:00:00.000Z",
      createdById: userId,
      createdByName: "Vardenis Pavardenis",
      batchCount: 2,
      pendingBatchCount: 1,
      createdAt: "2026-09-29T09:00:00.000Z",
      updatedAt: "2026-09-29T09:00:00.000Z",
    });
    expect(parsed.code).toBe("G2609-01");
    expect("warehouseId" in parsed).toBe(false);
  });

  it("parses a delivery detail with its batches", () => {
    const parsed = IncomingDeliveryDetailSchema.parse({
      id: deliveryId,
      code: "G2609-02",
      supplierId,
      supplierName: "Tiekėjas UAB",
      arrivalDate: "2026-09-29T00:00:00.000Z",
      createdById: userId,
      createdByName: "Vardenis Pavardenis",
      batchCount: 1,
      pendingBatchCount: 1,
      createdAt: "2026-09-29T09:00:00.000Z",
      updatedAt: "2026-09-29T09:00:00.000Z",
      batches: [batchPayload()],
    });
    expect(parsed.batches).toHaveLength(1);
    expect(parsed.batches[0]?.warehouseName).toBe("Pagrindinis");
  });
});

describe("CreateIncomingDeliveryRequestSchema", () => {
  it("accepts supplier and arrival date only", () => {
    expect(
      CreateIncomingDeliveryRequestSchema.safeParse({
        supplierId,
        arrivalDate: "2026-09-29T00:00:00.000Z",
      }).success,
    ).toBe(true);
  });

  it("rejects a warehouse, a missing id, a non-ISO date and a client code", () => {
    expect(
      CreateIncomingDeliveryRequestSchema.safeParse({
        supplierId,
        warehouseId,
        arrivalDate: "2026-09-29T00:00:00.000Z",
      }).success,
    ).toBe(false);
    expect(
      CreateIncomingDeliveryRequestSchema.safeParse({
        arrivalDate: "2026-09-29T00:00:00.000Z",
      }).success,
    ).toBe(false);
    expect(
      CreateIncomingDeliveryRequestSchema.safeParse({
        supplierId,
        arrivalDate: "2026-09-29",
      }).success,
    ).toBe(false);
    expect(
      CreateIncomingDeliveryRequestSchema.safeParse({
        supplierId,
        arrivalDate: "2026-09-29T00:00:00.000Z",
        code: "G2609-01",
      }).success,
    ).toBe(false);
  });
});

describe("ResolveBatchRequestSchema", () => {
  it("accepts a resource and a warehouse", () => {
    expect(
      ResolveBatchRequestSchema.safeParse({ resourceId, warehouseId }).success,
    ).toBe(true);
  });

  it("rejects a missing warehouse, a bad id and unknown fields", () => {
    expect(ResolveBatchRequestSchema.safeParse({ resourceId }).success).toBe(
      false,
    );
    expect(
      ResolveBatchRequestSchema.safeParse({ resourceId, warehouseId, unit: "KG" })
        .success,
    ).toBe(false);
  });
});
