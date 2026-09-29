import { describe, expect, it } from "vitest";
import {
  emptyResourceCategoryFormValues,
  resourceCategoryFormError,
  resourceCategoryFormToPayload,
} from "./resource-category-form";

describe("resource category form", () => {
  it("defaults a new category to active with a blank name", () => {
    expect(emptyResourceCategoryFormValues()).toEqual({ name: "", active: true });
  });

  it("requires a name", () => {
    expect(
      resourceCategoryFormError({ name: "   ", active: true }),
    ).toBe("Įveskite kategorijos pavadinimą.");
    expect(
      resourceCategoryFormError({ name: "Pakuotė", active: true }),
    ).toBeNull();
  });

  it("trims the payload name and keeps the active flag", () => {
    expect(
      resourceCategoryFormToPayload({ name: "  Pakuotė  ", active: false }),
    ).toEqual({ name: "Pakuotė", active: false });
  });
});
