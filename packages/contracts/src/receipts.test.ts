import { describe, expect, it } from "vitest";
import {
  CreateGoodsReceiptRequestSchema,
  DEFAULT_MEASUREMENT_UNIT,
  MEASUREMENT_UNIT_KEYS,
  MEASUREMENT_UNIT_LABELS,
} from "./receipts";

describe("measurement units", () => {
  it("maps unit keys to Lithuanian labels", () => {
    expect(MEASUREMENT_UNIT_LABELS.KG).toBe("kg");
    expect(MEASUREMENT_UNIT_LABELS.UNIT).toBe("vnt.");
  });

  it("defaults to KG", () => {
    expect(DEFAULT_MEASUREMENT_UNIT).toBe("KG");
    expect(MEASUREMENT_UNIT_KEYS).toContain(DEFAULT_MEASUREMENT_UNIT);
  });
});

const partnerId = "11111111-1111-4111-8111-111111111111";
const resourceId = "22222222-2222-4222-8222-222222222222";
const warehouseId = "33333333-3333-4333-8333-333333333333";
const locationId = "44444444-4444-4444-8444-444444444444";

function line(overrides: Record<string, unknown> = {}) {
  return {
    resourceId,
    quantity: "1250",
    unit: "KG",
    unitPrice: "1.42",
    warehouseId,
    warehouseLocationId: locationId,
    ...overrides,
  };
}

function payload(overrides: Record<string, unknown> = {}) {
  return { partnerId, lines: [line()], ...overrides };
}

describe("CreateGoodsReceiptRequestSchema", () => {
  it("accepts a valid receipt with decimal quantities and prices", () => {
    expect(CreateGoodsReceiptRequestSchema.safeParse(payload()).success).toBe(true);
    expect(
      CreateGoodsReceiptRequestSchema.safeParse(
        payload({
          lines: [
            line({ quantity: "12.5", unitPrice: "0" }),
            line({ quantity: "24", unit: "UNIT", unitPrice: "3.5" }),
          ],
        }),
      ).success,
    ).toBe(true);
  });

  it("requires at least one line", () => {
    expect(CreateGoodsReceiptRequestSchema.safeParse(payload({ lines: [] })).success).toBe(false);
  });

  it("requires a warehouse but accepts an omitted or empty location", () => {
    expect(
      CreateGoodsReceiptRequestSchema.safeParse(
        payload({ lines: [line({ warehouseId: undefined })] }),
      ).success,
    ).toBe(false);

    // warehouse required, location omitted
    const omitted = { resourceId, quantity: "1", unit: "KG", unitPrice: "1", warehouseId };
    expect(
      CreateGoodsReceiptRequestSchema.safeParse(
        payload({ lines: [omitted] }),
      ).success,
    ).toBe(true);

    // explicit empty string normalises to no location
    const empty = CreateGoodsReceiptRequestSchema.parse({
      partnerId,
      lines: [{ ...omitted, warehouseLocationId: "" }],
    });
    expect(empty.lines[0]?.warehouseLocationId).toBeUndefined();

    // supplied location must be a UUID
    expect(
      CreateGoodsReceiptRequestSchema.safeParse(
        payload({ lines: [line({ warehouseLocationId: "not-a-uuid" })] }),
      ).success,
    ).toBe(false);
  });

  it("rejects quantity <= 0 and negative prices", () => {
    for (const quantity of ["0", "0.0", "-5"]) {
      expect(
        CreateGoodsReceiptRequestSchema.safeParse(
          payload({ lines: [line({ quantity })] }),
        ).success,
      ).toBe(false);
    }
    expect(
      CreateGoodsReceiptRequestSchema.safeParse(
        payload({ lines: [line({ unitPrice: "-1" })] }),
      ).success,
    ).toBe(false);
  });

  it("rejects invalid units, non-decimal quantities and unknown fields", () => {
    expect(
      CreateGoodsReceiptRequestSchema.safeParse(
        payload({ lines: [line({ unit: "L" })] }),
      ).success,
    ).toBe(false);
    expect(
      CreateGoodsReceiptRequestSchema.safeParse(
        payload({ lines: [line({ quantity: "abc" })] }),
      ).success,
    ).toBe(false);
    expect(
      CreateGoodsReceiptRequestSchema.safeParse(
        payload({ lines: [line({ extra: 1 })] }),
      ).success,
    ).toBe(false);
    expect(
      CreateGoodsReceiptRequestSchema.safeParse({ ...payload(), status: "DRAFT" }).success,
    ).toBe(false);
  });
});
