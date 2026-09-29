import { describe, expect, it } from "vitest";
import {
  arrivalDateToIso,
  bagFormError,
  batchFormError,
  createDraftBag,
  createDraftBatch,
  toCreateBagPayload,
  toCreateBatchPayload,
} from "./batch-form";

describe("arrivalDateToIso", () => {
  it("converts a valid date to an ISO datetime", () => {
    const iso = arrivalDateToIso("2026-09-29");
    expect(iso).not.toBeNull();
    expect(new Date(iso as string).getFullYear()).toBe(2026);
  });

  it("returns null for malformed or non-date values", () => {
    expect(arrivalDateToIso("")).toBeNull();
    expect(arrivalDateToIso("29-09-2026")).toBeNull();
    expect(arrivalDateToIso("2026-13-01")).toBeNull();
    expect(arrivalDateToIso("2026-02-30")).toBeNull();
  });
});

describe("batchFormError", () => {
  it("requires resource, supplier, warehouse and a valid date", () => {
    const valid = {
      resourceId: "r",
      supplierId: "s",
      warehouseId: "w",
      arrivalDate: "2026-09-29",
    };
    expect(batchFormError(valid)).toBeNull();
    expect(batchFormError({ ...valid, resourceId: "" })).toBe(
      "Pasirinkite išteklių.",
    );
    expect(batchFormError({ ...valid, supplierId: "" })).toBe(
      "Pasirinkite tiekėją.",
    );
    expect(batchFormError({ ...valid, warehouseId: "" })).toBe(
      "Pasirinkite sandėlį.",
    );
    expect(batchFormError({ ...valid, arrivalDate: "" })).toBe(
      "Įveskite teisingą priėmimo datą.",
    );
  });
});

describe("toCreateBatchPayload", () => {
  it("converts the draft into the request payload", () => {
    const payload = toCreateBatchPayload({
      resourceId: "r",
      supplierId: "s",
      warehouseId: "w",
      arrivalDate: "2026-09-29",
    });
    expect(payload.resourceId).toBe("r");
    const parsed = new Date(payload.arrivalDate);
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(8);
    expect(parsed.getDate()).toBe(29);
  });
});

describe("bag form", () => {
  it("starts empty with no location", () => {
    expect(createDraftBag()).toEqual({ weight: "", warehouseLocationId: "" });
  });

  it("requires a positive decimal weight", () => {
    expect(bagFormError({ weight: "12.5", warehouseLocationId: "" })).toBeNull();
    expect(bagFormError({ weight: "0", warehouseLocationId: "" })).toBe(
      "Įveskite svorį, didesnį už nulį.",
    );
    expect(bagFormError({ weight: "abc", warehouseLocationId: "" })).toBe(
      "Įveskite svorį, didesnį už nulį.",
    );
  });

  it("omits an empty location from the payload", () => {
    expect(toCreateBagPayload({ weight: " 5 ", warehouseLocationId: "" })).toEqual(
      { weight: "5", warehouseLocationId: undefined },
    );
    expect(
      toCreateBagPayload({ weight: "5", warehouseLocationId: "loc" }).warehouseLocationId,
    ).toBe("loc");
  });
});

describe("createDraftBatch", () => {
  it("defaults to today's date and nothing selected", () => {
    const draft = createDraftBatch();
    expect(draft.resourceId).toBe("");
    expect(draft.supplierId).toBe("");
    expect(draft.warehouseId).toBe("");
    expect(draft.arrivalDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
