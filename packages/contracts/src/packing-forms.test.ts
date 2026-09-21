import { describe, expect, it } from "vitest";
import {
  CreatePackingFormRequestSchema,
  UpdatePackingFormRequestSchema,
} from "./packing-forms";

describe("CreatePackingFormRequestSchema", () => {
  it("requires a non-blank name and rejects unknown fields", () => {
    expect(CreatePackingFormRequestSchema.safeParse({ name: "  " }).success).toBe(
      false,
    );
    expect(
      CreatePackingFormRequestSchema.safeParse({ name: "Dėžė", weight: 10 }).success,
    ).toBe(false);
  });

  it("trims the name and defaults nothing unexpected", () => {
    const parsed = CreatePackingFormRequestSchema.parse({ name: "  Dėžė  " });
    expect(parsed.name).toBe("Dėžė");
    expect(parsed.active).toBeUndefined();
  });
});

describe("UpdatePackingFormRequestSchema", () => {
  it("rejects an empty update but allows rename or active change", () => {
    expect(UpdatePackingFormRequestSchema.safeParse({}).success).toBe(false);
    expect(UpdatePackingFormRequestSchema.safeParse({ name: "Rulonas" }).success).toBe(
      true,
    );
    expect(UpdatePackingFormRequestSchema.safeParse({ active: false }).success).toBe(
      true,
    );
  });
});
