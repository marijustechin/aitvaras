import { describe, expect, it } from "vitest";
import type { PackagingType } from "@aitvaras/contracts";
import {
  activePackagingTypes,
  EMPTY_PACKAGING_TYPES_MESSAGE,
  findPackagingType,
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
