import { describe, expect, it } from "vitest";
import type { Resource } from "@aitvaras/contracts";
import {
  emptyResourceFormValues,
  resourceFormError,
  resourceFormToPayload,
  resourceToFormValues,
} from "./resource-form";

const CATEGORY_ID = "0f1f2f3f-0000-4000-8000-000000000000";

const resource: Resource = {
  id: "1f1f2f3f-0000-4000-8000-000000000000",
  name: "Medvilninis audinys",
  categoryId: CATEGORY_ID,
  categoryName: "Žaliava",
  categoryActive: true,
  notes: null,
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("resource form values", () => {
  it("defaults a new resource to active with no category selected", () => {
    expect(emptyResourceFormValues()).toEqual({
      name: "",
      categoryId: "",
      notes: "",
      active: true,
    });
  });

  it("maps a resource to form values, turning nulls into empty strings", () => {
    const values = resourceToFormValues(resource);
    expect(values.name).toBe("Medvilninis audinys");
    expect(values.notes).toBe("");
    expect(values.categoryId).toBe(CATEGORY_ID);
    expect(values.active).toBe(true);
  });

  it("trims payload text and keeps the category id intact", () => {
    const payload = resourceFormToPayload({
      ...resourceToFormValues(resource),
      name: "  Audinys  ",
      notes: "  pastaba ",
    });
    expect(payload.name).toBe("Audinys");
    expect(payload.notes).toBe("pastaba");
    expect(payload.categoryId).toBe(CATEGORY_ID);
  });

  it("requires a name and a category", () => {
    expect(resourceFormError(resourceToFormValues(resource))).toBeNull();
    expect(
      resourceFormError({ ...resourceToFormValues(resource), name: "  " }),
    ).toBe("Įveskite ištekliaus pavadinimą.");
    expect(
      resourceFormError({ ...resourceToFormValues(resource), categoryId: "" }),
    ).toBe("Pasirinkite kategoriją.");
  });
});
