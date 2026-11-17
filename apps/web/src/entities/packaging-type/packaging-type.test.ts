import { describe, expect, it } from "vitest";
import type { PackagingType } from "@aitvaras/contracts";
import {
  activePackagingTypes,
  EMPTY_PACKAGING_TYPES_MESSAGE,
  findPackagingType,
  formatTareWeightKg,
  packagingTypeOptionLabel,
} from "./packaging-type";

function type(overrides: Partial<PackagingType> = {}): PackagingType {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Maišas",
    tareWeightKg: "0.800",
    active: true,
    createdAt: "2026-09-29T09:00:00.000Z",
    updatedAt: "2026-09-29T09:00:00.000Z",
    ...overrides,
  };
}

describe("activePackagingTypes", () => {
  it("keeps only active types, name-sorted", () => {
    const list = activePackagingTypes([
      type({ id: "b", name: "EPAL", active: true }),
      type({ id: "a", name: "Dėžė", active: true }),
      type({ id: "c", name: "Sena", active: false }),
    ]);
    expect(list.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("exposes the empty-state text", () => {
    expect(EMPTY_PACKAGING_TYPES_MESSAGE).toBe("Taros dar nėra.");
  });
});

describe("findPackagingType", () => {
  it("finds active and inactive types, else null", () => {
    const types = [type({ id: "a" }), type({ id: "b", active: false })];
    expect(findPackagingType(types, "a")?.id).toBe("a");
    expect(findPackagingType(types, "b")?.id).toBe("b");
    expect(findPackagingType(types, "z")).toBeNull();
  });
});

describe("tare selector labels", () => {
  it("keeps at least one decimal and up to stored precision", () => {
    expect(formatTareWeightKg("0.200")).toBe("0,2");
    expect(formatTareWeightKg("27.000")).toBe("27,0");
    expect(formatTareWeightKg("0.125")).toBe("0,125");
    expect(formatTareWeightKg("1234.500").replace(/\s/g, " ")).toBe("1 234,5");
  });

  it("labels the option as name and weight", () => {
    expect(packagingTypeOptionLabel(type({ name: "Dėžė", tareWeightKg: "0.200" }))).toBe(
      "Dėžė (0,2 kg)",
    );
    expect(packagingTypeOptionLabel(type({ name: "Paletė", tareWeightKg: "27.000" }))).toBe(
      "Paletė (27,0 kg)",
    );
  });
});
