import { describe, expect, it } from "vitest";
import {
  createDraftPackagingType,
  packagingTypeFormError,
  toCreatePackagingTypePayload,
  toUpdatePackagingTypePayload,
} from "./packaging-type-form";

describe("packaging-type form", () => {
  it("starts empty", () => {
    expect(createDraftPackagingType()).toEqual({ name: "", tareWeightKg: "" });
  });

  it("requires a name and a valid non-negative tare weight", () => {
    expect(
      packagingTypeFormError({ name: "Maišas", tareWeightKg: "0.800" }),
    ).toBeNull();
    expect(packagingTypeFormError({ name: "EPAL", tareWeightKg: "27" })).toBeNull();
    expect(packagingTypeFormError({ name: "Be taros", tareWeightKg: "0" })).toBeNull();
    expect(packagingTypeFormError({ name: "  ", tareWeightKg: "1" })).toBe(
      "Įveskite taros pavadinimą.",
    );
    for (const tareWeightKg of ["", "-1", "abc", "1.2345"]) {
      expect(
        packagingTypeFormError({ name: "Maišas", tareWeightKg }),
        tareWeightKg,
      ).toBe("Įveskite taros svorį kg (pvz., 0.800).");
    }
  });

  it("builds trimmed create and update payloads", () => {
    const draft = { name: " Maišas ", tareWeightKg: " 0.800 " };
    expect(toCreatePackagingTypePayload(draft)).toEqual({
      name: "Maišas",
      tareWeightKg: "0.800",
    });
    expect(toUpdatePackagingTypePayload(draft)).toEqual({
      name: "Maišas",
      tareWeightKg: "0.800",
    });
  });
});
