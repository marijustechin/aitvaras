import { describe, expect, it } from "vitest";
import type {
  Bag,
  Batch,
  BatchDetail,
  HandlingUnitKey,
} from "@aitvaras/contracts";
import {
  arrivalDateToIso,
  bagFormError,
  batchFormError,
  correctionChanged,
  correctionDraftFromBag,
  correctionFormError,
  createDraftBag,
  createDraftBatch,
  createDraftReconciliation,
  initialBagDraft,
  reconciliationFormError,
  toCreateBagPayload,
  toCreateBatchPayload,
  toReconcilePayload,
  toUpdateBagPayload,
  toVoidBagPayload,
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

describe("handling-unit form", () => {
  it("starts with the default unit, no quantity and no location", () => {
    expect(createDraftBag()).toEqual({
      unit: "KG",
      quantity: "",
      warehouseLocationId: "",
    });
  });

  it("requires a warehouse location", () => {
    expect(
      bagFormError({ unit: "KG", quantity: "10", warehouseLocationId: "" }),
    ).toBe("Pasirinkite sandėlio vietą.");
  });

  it("accepts a positive decimal KG quantity", () => {
    expect(
      bagFormError({ unit: "KG", quantity: "48.725", warehouseLocationId: "loc" }),
    ).toBeNull();
  });

  it("accepts a whole PCS quantity and rejects a fractional one", () => {
    expect(
      bagFormError({ unit: "PCS", quantity: "12", warehouseLocationId: "loc" }),
    ).toBeNull();
    expect(
      bagFormError({ unit: "PCS", quantity: "12.5", warehouseLocationId: "loc" }),
    ).toBe("Vienetų kiekis turi būti sveikas skaičius.");
  });

  it("rejects a non-positive quantity", () => {
    expect(
      bagFormError({ unit: "KG", quantity: "0", warehouseLocationId: "loc" }),
    ).toBe("Įveskite svorį, didesnį už nulį.");
    expect(
      bagFormError({ unit: "PCS", quantity: "0", warehouseLocationId: "loc" }),
    ).toBe("Įveskite vienetų kiekį (sveiką skaičių).");
  });

  it("builds the payload with the unit, trimmed quantity and location", () => {
    expect(
      toCreateBagPayload({
        unit: "KG",
        quantity: " 5 ",
        warehouseLocationId: "loc",
      }),
    ).toEqual({ unit: "KG", quantity: "5", warehouseLocationId: "loc" });
  });
});

describe("initialBagDraft", () => {
  const asBatch = (unit: HandlingUnitKey | null): Batch =>
    ({ unit }) as unknown as Batch;
  const asDetail = (
    unit: HandlingUnitKey | null,
    suggestedLocationId: string | null,
  ): BatchDetail =>
    ({ unit, suggestedLocationId }) as unknown as BatchDetail;

  it("defaults to KG with no location for a batch without units", () => {
    expect(initialBagDraft(asBatch(null))).toEqual({
      unit: "KG",
      quantity: "",
      warehouseLocationId: "",
    });
  });

  it("inherits the established unit and suggests the last location", () => {
    expect(initialBagDraft(asDetail("PCS", "loc-1"))).toEqual({
      unit: "PCS",
      quantity: "",
      warehouseLocationId: "loc-1",
    });
  });

  it("leaves the location unselected when there is no previous unit", () => {
    expect(initialBagDraft(asDetail(null, null)).warehouseLocationId).toBe("");
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

describe("handling-unit correction form", () => {
  const bag = {
    id: "bag-1",
    quantity: "25.5",
    warehouseLocationId: "loc-1",
    unit: "KG",
  } as unknown as Bag;

  it("prefills the draft from the unit", () => {
    expect(correctionDraftFromBag(bag)).toEqual({
      id: "bag-1",
      quantity: "25.5",
      warehouseLocationId: "loc-1",
    });
  });

  it("detects whether anything actually changed", () => {
    const draft = correctionDraftFromBag(bag);
    expect(correctionChanged(draft, bag)).toBe(false);
    expect(correctionChanged({ ...draft, quantity: "30" }, bag)).toBe(true);
    expect(correctionChanged({ ...draft, warehouseLocationId: "loc-2" }, bag)).toBe(
      true,
    );
  });

  it("validates the quantity by unit and requires a location", () => {
    const draft = correctionDraftFromBag(bag);
    expect(correctionFormError(draft, "KG")).toBeNull();
    expect(correctionFormError({ ...draft, quantity: "0" }, "KG")).toBe(
      "Įveskite svorį, didesnį už nulį.",
    );
    expect(correctionFormError({ ...draft, quantity: "2.5" }, "PCS")).toBe(
      "Vienetų kiekis turi būti sveikas skaičius.",
    );
    expect(correctionFormError({ ...draft, warehouseLocationId: "" }, "KG")).toBe(
      "Pasirinkite sandėlio vietą.",
    );
  });

  it("sends only changed fields; a no-op yields an empty payload", () => {
    const draft = correctionDraftFromBag(bag);
    expect(toUpdateBagPayload(draft, bag)).toEqual({});
    expect(toUpdateBagPayload({ ...draft, quantity: "30" }, bag)).toEqual({
      quantity: "30",
    });
    expect(
      toUpdateBagPayload({ ...draft, warehouseLocationId: "loc-2" }, bag),
    ).toEqual({ warehouseLocationId: "loc-2" });
    expect(
      toUpdateBagPayload(
        { ...draft, quantity: "30", warehouseLocationId: "loc-2" },
        bag,
      ),
    ).toEqual({ quantity: "30", warehouseLocationId: "loc-2" });
  });

  it("builds the void payload with or without a reason", () => {
    expect(toVoidBagPayload("")).toEqual({});
    expect(toVoidBagPayload("   ")).toEqual({});
    expect(toVoidBagPayload(" Sugedęs ")).toEqual({ reason: "Sugedęs" });
  });
});

describe("reconciliation form", () => {
  it("starts empty with no technical receipt-line field", () => {
    const draft = createDraftReconciliation();
    expect(draft).toEqual({
      documentWeight: "",
      acquisitionAmount: "",
      documentDate: "",
      documentNumber: "",
    });
    expect("receiptLineId" in draft).toBe(false);
  });

  it("requires a positive weight and a valid amount", () => {
    const valid = {
      documentWeight: "10",
      acquisitionAmount: "0",
      documentDate: "",
      documentNumber: "",
    };
    expect(reconciliationFormError(valid)).toBeNull();
    expect(reconciliationFormError({ ...valid, documentWeight: "0" })).toBe(
      "Įveskite dokumentinį svorį, didesnį už nulį.",
    );
    expect(reconciliationFormError({ ...valid, acquisitionAmount: "-1" })).toBe(
      "Įveskite įsigijimo vertę (gali būti 0).",
    );
    expect(
      reconciliationFormError({ ...valid, documentDate: "2026-02-30" }),
    ).toBe("Įveskite teisingą dokumento datą.");
  });

  it("builds a payload without the measured total or a receipt-line id", () => {
    const payload = toReconcilePayload({
      documentWeight: " 10.5 ",
      acquisitionAmount: " 20 ",
      documentDate: "",
      documentNumber: "",
    });
    expect(payload).toEqual({
      documentWeight: "10.5",
      acquisitionAmount: "20",
    });
    expect("measuredWeight" in payload).toBe(false);
    expect("receiptLineId" in payload).toBe(false);
  });

  it("includes the optional document date and number when given", () => {
    const payload = toReconcilePayload({
      documentWeight: "10",
      acquisitionAmount: "0",
      documentDate: "2026-09-20",
      documentNumber: " SF-1 ",
    });
    expect(payload.documentDate).toBeDefined();
    expect(new Date(payload.documentDate as string).getFullYear()).toBe(2026);
    expect(payload.documentNumber).toBe("SF-1");
  });
});
