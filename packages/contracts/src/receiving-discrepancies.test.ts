import { describe, expect, it } from "vitest";
import {
  CreateDiscrepancySettlementRequestSchema,
  DISCREPANCY_DIRECTION_LABELS,
  DISCREPANCY_SETTLEMENT_TYPE_LABELS,
  discrepancyDirection,
  RECEIVING_DISCREPANCY_STATUS_LABELS,
  ReceivingDiscrepancyDetailSchema,
} from "./receiving-discrepancies";

describe("discrepancyDirection", () => {
  it("maps a negative difference to a shortage and positive to an overage", () => {
    expect(discrepancyDirection("-20.000")).toBe("SHORTAGE");
    expect(discrepancyDirection("+20.000")).toBe("OVERAGE");
    expect(discrepancyDirection("12.500")).toBe("OVERAGE");
  });

  it("exposes Lithuanian human-facing labels", () => {
    expect(DISCREPANCY_DIRECTION_LABELS.SHORTAGE).toBe("Trūkumas");
    expect(DISCREPANCY_DIRECTION_LABELS.OVERAGE).toBe("Perteklius");
    expect(RECEIVING_DISCREPANCY_STATUS_LABELS.PARTIALLY_SETTLED).toBe(
      "Dalinai padengtas",
    );
    expect(DISCREPANCY_SETTLEMENT_TYPE_LABELS.WEIGHT).toBe("Svoriu");
    expect(DISCREPANCY_SETTLEMENT_TYPE_LABELS.MONEY).toBe("Pinigais");
  });
});

describe("CreateDiscrepancySettlementRequestSchema", () => {
  it("accepts a weight settlement", () => {
    const parsed = CreateDiscrepancySettlementRequestSchema.safeParse({
      type: "WEIGHT",
      coveredWeightKg: "8",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts a money settlement with amount and currency", () => {
    const parsed = CreateDiscrepancySettlementRequestSchema.safeParse({
      type: "MONEY",
      coveredWeightKg: "20",
      moneyAmount: "45",
      currency: "EUR",
    });
    expect(parsed.success).toBe(true);
  });

  it("requires a covered weight and rejects unknown fields", () => {
    expect(
      CreateDiscrepancySettlementRequestSchema.safeParse({ type: "WEIGHT" })
        .success,
    ).toBe(false);
    expect(
      CreateDiscrepancySettlementRequestSchema.safeParse({
        type: "WEIGHT",
        coveredWeightKg: "1",
        remainingWeight: "0",
      }).success,
    ).toBe(false);
  });
});

describe("ReceivingDiscrepancyDetailSchema", () => {
  it("parses a detail with derived balance and settlement history", () => {
    const parsed = ReceivingDiscrepancyDetailSchema.parse({
      id: "11111111-1111-4111-8111-111111111111",
      batchId: "22222222-2222-4222-8222-222222222222",
      deliveryId: "33333333-3333-4333-8333-333333333333",
      deliveryCode: "G2610-01",
      batchCode: "P01",
      supplierId: "44444444-4444-4444-8444-444444444444",
      supplierName: "Tiekėjas UAB",
      resourceId: "55555555-5555-4555-8555-555555555555",
      resourceName: "Cukrus",
      warehouseName: "Pagrindinis",
      arrivalDate: "2026-10-01T00:00:00.000Z",
      measuredWeight: "980.000",
      documentWeight: "1000.000",
      differenceWeight: "-20.000",
      direction: "SHORTAGE",
      originalWeight: "20.000",
      settledWeight: "8.000",
      remainingWeight: "12.000",
      status: "PARTIALLY_SETTLED",
      createdById: "66666666-6666-4666-8666-666666666666",
      createdByName: "Vardenis Pavardenis",
      createdAt: "2026-10-01T09:00:00.000Z",
      settledAt: null,
      settlements: [],
    });
    expect(parsed.remainingWeight).toBe("12.000");
    expect(parsed.direction).toBe("SHORTAGE");
  });
});
