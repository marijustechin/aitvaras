import { describe, expect, it } from "vitest";
import {
  CreateResourceRequestSchema,
  RESOURCE_CATEGORY_KEYS,
  RESOURCE_CATEGORY_LABELS,
  UpdateResourceRequestSchema,
} from "./resources";

describe("resource category labels", () => {
  it("provides a non-empty Lithuanian label for every category", () => {
    for (const key of RESOURCE_CATEGORY_KEYS) {
      expect(typeof RESOURCE_CATEGORY_LABELS[key]).toBe("string");
      expect(RESOURCE_CATEGORY_LABELS[key].length).toBeGreaterThan(0);
    }
  });

  it("maps the confirmed categories", () => {
    expect(RESOURCE_CATEGORY_LABELS.RAW_MATERIAL).toBe("Žaliava");
    expect(RESOURCE_CATEGORY_LABELS.SEMI_FINISHED).toBe("Pusgaminis");
    expect(RESOURCE_CATEGORY_LABELS.FINISHED_PRODUCT).toBe("Gaminys");
  });

  it("does not expose the raw key as its label", () => {
    for (const key of RESOURCE_CATEGORY_KEYS) {
      expect(RESOURCE_CATEGORY_LABELS[key]).not.toBe(key);
    }
  });
});

describe("CreateResourceRequestSchema", () => {
  it("requires a non-blank name and a valid category", () => {
    expect(
      CreateResourceRequestSchema.safeParse({ name: "   ", category: "RAW_MATERIAL" })
        .success,
    ).toBe(false);
    expect(
      CreateResourceRequestSchema.safeParse({ name: "Audinys", category: "NOPE" })
        .success,
    ).toBe(false);
    expect(CreateResourceRequestSchema.safeParse({ name: "Audinys" }).success).toBe(
      false,
    );
  });

  it("accepts each confirmed category", () => {
    for (const category of RESOURCE_CATEGORY_KEYS) {
      expect(
        CreateResourceRequestSchema.safeParse({ name: "Audinys", category }).success,
      ).toBe(true);
    }
  });

  it("trims text, normalises empty notes to null and rejects unknown fields", () => {
    const parsed = CreateResourceRequestSchema.parse({
      name: "  Audinys  ",
      category: "SEMI_FINISHED",
      notes: "  ",
    });
    expect(parsed.name).toBe("Audinys");
    expect(parsed.notes).toBeNull();

    expect(
      CreateResourceRequestSchema.safeParse({
        name: "Audinys",
        category: "RAW_MATERIAL",
        quantity: 5,
      }).success,
    ).toBe(false);
    expect(
      CreateResourceRequestSchema.safeParse({
        name: "Audinys",
        category: "RAW_MATERIAL",
        id: "0f1f2f3f-0000-4000-8000-000000000000",
      }).success,
    ).toBe(false);
  });
});

describe("UpdateResourceRequestSchema", () => {
  it("rejects an empty update and unknown fields, allows a single change", () => {
    expect(UpdateResourceRequestSchema.safeParse({}).success).toBe(false);
    expect(
      UpdateResourceRequestSchema.safeParse({ packingFormId: "x" }).success,
    ).toBe(false);
    expect(
      UpdateResourceRequestSchema.safeParse({ active: false }).success,
    ).toBe(true);
    expect(
      UpdateResourceRequestSchema.safeParse({ category: "FINISHED_PRODUCT" })
        .success,
    ).toBe(true);
  });
});
