import { describe, expect, it } from "vitest";
import {
  CreateWarehouseLocationRequestSchema,
  CreateWarehouseRequestSchema,
  UpdateWarehouseLocationRequestSchema,
  UpdateWarehouseRequestSchema,
} from "./warehouses";

describe("warehouse request schemas", () => {
  it("requires a non-blank warehouse name", () => {
    expect(CreateWarehouseRequestSchema.safeParse({ name: "  " }).success).toBe(
      false,
    );
    expect(CreateWarehouseRequestSchema.safeParse({ name: "Sandėlis A" }).success).toBe(
      true,
    );
  });

  it("trims and rejects unknown fields", () => {
    expect(CreateWarehouseRequestSchema.parse({ name: "  Sandėlis A " }).name).toBe(
      "Sandėlis A",
    );
    expect(
      CreateWarehouseRequestSchema.safeParse({ name: "A", address: "x" }).success,
    ).toBe(false);
  });

  it("rejects an empty/unknown update but allows rename or active change", () => {
    expect(UpdateWarehouseRequestSchema.safeParse({}).success).toBe(false);
    expect(UpdateWarehouseRequestSchema.safeParse({ extra: 1 }).success).toBe(false);
    expect(UpdateWarehouseRequestSchema.safeParse({ name: "B" }).success).toBe(true);
    expect(UpdateWarehouseRequestSchema.safeParse({ active: false }).success).toBe(
      true,
    );
  });
});

describe("warehouse location request schemas", () => {
  it("requires a non-blank name and rejects unknown fields", () => {
    expect(
      CreateWarehouseLocationRequestSchema.safeParse({ name: "  " }).success,
    ).toBe(false);
    expect(
      CreateWarehouseLocationRequestSchema.safeParse({ name: "Stelažas A1" }).success,
    ).toBe(true);
    expect(
      CreateWarehouseLocationRequestSchema.safeParse({ name: "A", warehouseId: "x" })
        .success,
    ).toBe(false);
  });

  it("rejects an empty location update", () => {
    expect(UpdateWarehouseLocationRequestSchema.safeParse({}).success).toBe(false);
    expect(UpdateWarehouseLocationRequestSchema.safeParse({ name: "B2" }).success).toBe(
      true,
    );
  });
});
