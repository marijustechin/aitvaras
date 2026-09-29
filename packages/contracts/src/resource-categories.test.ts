import { describe, expect, it } from "vitest";
import {
  CreateResourceCategoryRequestSchema,
  ResourceCategorySchema,
  UpdateResourceCategoryRequestSchema,
} from "./resource-categories";

const ID = "0f1f2f3f-0000-4000-8000-000000000000";

describe("CreateResourceCategoryRequestSchema", () => {
  it("requires a non-blank name and trims it", () => {
    expect(
      CreateResourceCategoryRequestSchema.safeParse({ name: "   " }).success,
    ).toBe(false);
    const parsed = CreateResourceCategoryRequestSchema.parse({
      name: "  Pakuotė  ",
    });
    expect(parsed.name).toBe("Pakuotė");
  });

  it("accepts an optional active flag and rejects unknown fields", () => {
    expect(
      CreateResourceCategoryRequestSchema.safeParse({ name: "Pakuotė", active: false })
        .success,
    ).toBe(true);
    expect(
      CreateResourceCategoryRequestSchema.safeParse({ name: "Pakuotė", code: "X" })
        .success,
    ).toBe(false);
  });
});

describe("UpdateResourceCategoryRequestSchema", () => {
  it("rejects an empty update, allows a rename or an active change", () => {
    expect(UpdateResourceCategoryRequestSchema.safeParse({}).success).toBe(false);
    expect(
      UpdateResourceCategoryRequestSchema.safeParse({ name: "Pakuotė" }).success,
    ).toBe(true);
    expect(
      UpdateResourceCategoryRequestSchema.safeParse({ active: false }).success,
    ).toBe(true);
  });
});

describe("ResourceCategorySchema", () => {
  it("describes the safe response shape", () => {
    const result = ResourceCategorySchema.safeParse({
      id: ID,
      name: "Žaliava",
      active: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });
});
