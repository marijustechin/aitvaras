import { describe, expect, it } from "vitest";
import {
  BatchStatusSchema,
  BATCH_STATUSES,
  BATCH_STATUS_LABELS,
  CreateBagRequestSchema,
  CreateBatchRequestSchema,
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
  it("accepts a positive decimal weight", () => {
    expect(CreateBagRequestSchema.safeParse({ weight: "25.5" }).success).toBe(
      true,
    );
  });

  it("normalises an omitted or empty location to undefined", () => {
    expect(
      CreateBagRequestSchema.parse({ weight: "10" }).warehouseLocationId,
    ).toBeUndefined();
    expect(
      CreateBagRequestSchema.parse({ weight: "10", warehouseLocationId: "" })
        .warehouseLocationId,
    ).toBeUndefined();
    expect(
      CreateBagRequestSchema.parse({ weight: "10", warehouseLocationId: locationId })
        .warehouseLocationId,
    ).toBe(locationId);
  });

  it("rejects zero, negative and non-decimal weights", () => {
    for (const weight of ["0", "0.0", "-1", "abc", ""]) {
      expect(CreateBagRequestSchema.safeParse({ weight }).success).toBe(false);
    }
  });

  it("rejects a non-uuid location and unknown fields", () => {
    expect(
      CreateBagRequestSchema.safeParse({
        weight: "10",
        warehouseLocationId: "not-a-uuid",
      }).success,
    ).toBe(false);
    expect(
      CreateBagRequestSchema.safeParse({ weight: "10", barcode: "123" }).success,
    ).toBe(false);
  });
});
