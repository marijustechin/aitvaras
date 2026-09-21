import { describe, expect, it } from "vitest";
import type { Resource } from "@aitvaras/contracts";
import {
  emptyResourceFormValues,
  resourceFormError,
  resourceFormToPayload,
  resourceToFormValues,
} from "./resource-form";

const resource: Resource = {
  id: "0f1f2f3f-0000-4000-8000-000000000000",
  name: "Medvilninis audinys",
  category: "RAW_MATERIAL",
  notes: null,
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("resource form values", () => {
  it("defaults a new resource to active and the first category", () => {
    expect(emptyResourceFormValues()).toEqual({
      name: "",
      category: "RAW_MATERIAL",
      notes: "",
      active: true,
    });
  });

  it("maps a resource to form values, turning nulls into empty strings", () => {
    const values = resourceToFormValues(resource);
    expect(values.name).toBe("Medvilninis audinys");
    expect(values.notes).toBe("");
    expect(values.category).toBe("RAW_MATERIAL");
    expect(values.active).toBe(true);
  });

  it("trims payload text", () => {
    const payload = resourceFormToPayload({
      ...resourceToFormValues(resource),
      name: "  Audinys  ",
      notes: "  pastaba ",
    });
    expect(payload.name).toBe("Audinys");
    expect(payload.notes).toBe("pastaba");
  });

  it("requires a name", () => {
    expect(resourceFormError(resourceToFormValues(resource))).toBeNull();
    expect(resourceFormError({ ...resourceToFormValues(resource), name: "  " })).toBe(
      "Įveskite ištekliaus pavadinimą.",
    );
  });
});
