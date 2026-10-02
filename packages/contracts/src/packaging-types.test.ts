import { describe, expect, it } from "vitest";
import {
  CreatePackagingTypeRequestSchema,
  PackagingTypeSchema,
  UpdatePackagingTypeRequestSchema,
} from "./packaging-types";

describe("PackagingTypeSchema", () => {
  it("parses a packaging type with a decimal tare weight string", () => {
    const parsed = PackagingTypeSchema.parse({
      id: "11111111-1111-4111-8111-111111111111",
      name: "EPAL",
      tareWeightKg: "27.000",
      active: true,
      createdAt: "2026-09-29T09:00:00.000Z",
      updatedAt: "2026-09-29T09:00:00.000Z",
    });
    expect(parsed.tareWeightKg).toBe("27.000");
  });
});

describe("CreatePackagingTypeRequestSchema", () => {
  it("accepts a name and a non-negative tare weight (0 allowed)", () => {
    expect(
      CreatePackagingTypeRequestSchema.safeParse({
        name: "Maišas",
        tareWeightKg: "0.800",
      }).success,
    ).toBe(true);
    expect(
      CreatePackagingTypeRequestSchema.safeParse({
        name: "Be taros",
        tareWeightKg: "0",
      }).success,
    ).toBe(true);
  });

  it("rejects an empty name, a bad tare weight and unknown fields", () => {
    expect(
      CreatePackagingTypeRequestSchema.safeParse({ name: "", tareWeightKg: "1" })
        .success,
    ).toBe(false);
    for (const tareWeightKg of ["", "-1", "abc", "1.2345"]) {
      expect(
        CreatePackagingTypeRequestSchema.safeParse({ name: "Maišas", tareWeightKg })
          .success,
        tareWeightKg,
      ).toBe(false);
    }
    expect(
      CreatePackagingTypeRequestSchema.safeParse({
        name: "Maišas",
        tareWeightKg: "1",
        id: "x",
      }).success,
    ).toBe(false);
  });
});

describe("UpdatePackagingTypeRequestSchema", () => {
  it("accepts name, tare weight and/or active", () => {
    expect(
      UpdatePackagingTypeRequestSchema.safeParse({ name: "Kita" }).success,
    ).toBe(true);
    expect(
      UpdatePackagingTypeRequestSchema.safeParse({ tareWeightKg: "1.5" }).success,
    ).toBe(true);
    expect(
      UpdatePackagingTypeRequestSchema.safeParse({ active: false }).success,
    ).toBe(true);
  });

  it("requires at least one field and rejects a bad tare weight", () => {
    expect(UpdatePackagingTypeRequestSchema.safeParse({}).success).toBe(false);
    expect(
      UpdatePackagingTypeRequestSchema.safeParse({ tareWeightKg: "-1" }).success,
    ).toBe(false);
  });
});
