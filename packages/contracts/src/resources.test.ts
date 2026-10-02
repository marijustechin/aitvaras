import { describe, expect, it } from "vitest";
import {
  CreateResourceRequestSchema,
  UpdateResourceRequestSchema,
} from "./resources";

const CATEGORY_ID = "0f1f2f3f-0000-4000-8000-000000000000";

describe("CreateResourceRequestSchema", () => {
  it("requires a non-blank name and a category uuid", () => {
    expect(
      CreateResourceRequestSchema.safeParse({ name: "   ", categoryId: CATEGORY_ID })
        .success,
    ).toBe(false);
    expect(
      CreateResourceRequestSchema.safeParse({ name: "Audinys", categoryId: "nope" })
        .success,
    ).toBe(false);
    expect(CreateResourceRequestSchema.safeParse({ name: "Audinys" }).success).toBe(
      false,
    );
  });

  it("accepts a valid name and category", () => {
    expect(
      CreateResourceRequestSchema.safeParse({
        name: "Audinys",
        categoryId: CATEGORY_ID,
      }).success,
    ).toBe(true);
  });

  it("trims text, normalises empty notes to null and rejects unknown fields", () => {
    const parsed = CreateResourceRequestSchema.parse({
      name: "  Audinys  ",
      categoryId: CATEGORY_ID,
      notes: "  ",
    });
    expect(parsed.name).toBe("Audinys");
    expect(parsed.notes).toBeNull();

    expect(
      CreateResourceRequestSchema.safeParse({
        name: "Audinys",
        categoryId: CATEGORY_ID,
        quantity: 5,
      }).success,
    ).toBe(false);
    expect(
      CreateResourceRequestSchema.safeParse({
        name: "Audinys",
        categoryId: CATEGORY_ID,
        id: CATEGORY_ID,
      }).success,
    ).toBe(false);
    // The obsolete fixed-category field is rejected.
    expect(
      CreateResourceRequestSchema.safeParse({
        name: "Audinys",
        category: "RAW_MATERIAL",
      }).success,
    ).toBe(false);
  });
});

describe("UpdateResourceRequestSchema", () => {
  it("rejects an empty update and unknown fields, allows a single change", () => {
    expect(UpdateResourceRequestSchema.safeParse({}).success).toBe(false);
    expect(
      UpdateResourceRequestSchema.safeParse({ unknownField: "x" }).success,
    ).toBe(false);
    expect(
      UpdateResourceRequestSchema.safeParse({ active: false }).success,
    ).toBe(true);
    expect(
      UpdateResourceRequestSchema.safeParse({ categoryId: CATEGORY_ID }).success,
    ).toBe(true);
  });
});
