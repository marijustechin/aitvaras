import { describe, expect, it } from "vitest";
import type { Bag, BatchItem } from "@aitvaras/contracts";
import {
  arrivalDateToIso,
  bagFormError,
  correctionChanged,
  correctionDraftFromBag,
  correctionFormError,
  createDraftBag,
  createDraftDelivery,
  createDraftPieceConfirmation,
  createDraftPieceItem,
  createDraftQuickResource,
  createDraftReconciliation,
  createDraftResource,
  deliveryFormError,
  pieceConfirmationFormError,
  pieceConfirmationRows,
  pieceCorrectionChanged,
  pieceCorrectionFromItem,
  pieceCorrectionFormError,
  pieceItemFormError,
  pieceRowDifference,
  pieceRowDocumentPieces,
  type PieceConfirmationRow,
  quickResourceFormError,
  reconciliationFormError,
  resourceFormError,
  toConfirmPiecePayload,
  toCreateBagPayload,
  toCreateDeliveryPayload,
  toCreateItemPayload,
  toQuickCreateResourcePayload,
  toReconcilePayload,
  toResolveBatchPayload,
  toUpdateBagPayload,
  toUpdateItemPayload,
  toVoidBagPayload,
  toVoidItemPayload,
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

describe("delivery form", () => {
  it("defaults to today's date and nothing selected (no warehouse)", () => {
    const draft = createDraftDelivery();
    expect(draft.supplierId).toBe("");
    expect(draft.arrivalDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect("warehouseId" in draft).toBe(false);
  });

  it("requires supplier and a valid arrival date", () => {
    const valid = { supplierId: "s", arrivalDate: "2026-09-29" };
    expect(deliveryFormError(valid)).toBeNull();
    expect(deliveryFormError({ ...valid, supplierId: "" })).toBe(
      "Pasirinkite tiekėją.",
    );
    expect(deliveryFormError({ ...valid, arrivalDate: "" })).toBe(
      "Įveskite teisingą priėmimo datą.",
    );
  });

  it("converts the draft into the create-delivery payload (no warehouse)", () => {
    const payload = toCreateDeliveryPayload({
      supplierId: "s",
      arrivalDate: "2026-09-29",
    });
    expect(payload.supplierId).toBe("s");
    expect("warehouseId" in payload).toBe(false);
    const parsed = new Date(payload.arrivalDate);
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(8);
    expect(parsed.getDate()).toBe(29);
  });
});

describe("resource selection", () => {
  it("defaults to nothing selected (no unit)", () => {
    expect(createDraftResource()).toEqual({
      resourceId: "",
      warehouseId: "",
    });
  });

  it("requires a resource and a warehouse", () => {
    expect(resourceFormError({ resourceId: "", warehouseId: "w" })).toBe(
      "Pasirinkite išteklių.",
    );
    expect(resourceFormError({ resourceId: "r", warehouseId: "" })).toBe(
      "Pasirinkite sandėlį.",
    );
    expect(resourceFormError({ resourceId: "r", warehouseId: "w" })).toBeNull();
  });

  it("converts the selection into the resolve-batch payload", () => {
    expect(toResolveBatchPayload({ resourceId: "r", warehouseId: "w" })).toEqual({
      receivingMode: "WEIGHT",
      resourceId: "r",
      warehouseId: "w",
    });
  });

  it("requires only a warehouse for a PIECE batch", () => {
    expect(resourceFormError({ resourceId: "", warehouseId: "w" }, "PIECE")).toBeNull();
    expect(resourceFormError({ resourceId: "", warehouseId: "" }, "PIECE")).toBe(
      "Pasirinkite sandėlį.",
    );
    expect(
      toResolveBatchPayload({ resourceId: "r", warehouseId: "w" }, "PIECE"),
    ).toEqual({ receivingMode: "PIECE", warehouseId: "w" });
  });
});

describe("handling-unit form", () => {
  const base = {
    packagingTypeId: "tara",
    grossWeight: "10",
    warehouseLocationId: "loc",
  };

  it("starts with no packaging, weight and location", () => {
    expect(createDraftBag()).toEqual({
      packagingTypeId: "",
      grossWeight: "",
      warehouseLocationId: "",
    });
  });

  it("requires a packaging type", () => {
    expect(bagFormError({ ...base, packagingTypeId: "" })).toBe(
      "Pasirinkite tarą.",
    );
  });

  it("requires a warehouse location", () => {
    expect(bagFormError({ ...base, warehouseLocationId: "" })).toBe(
      "Pasirinkite sandėlio vietą.",
    );
  });

  it("accepts a positive decimal gross weight", () => {
    expect(bagFormError({ ...base, grossWeight: "48.725" })).toBeNull();
  });

  it("rejects a non-positive or non-numeric gross weight", () => {
    for (const grossWeight of ["0", "-1", "abc", ""]) {
      expect(bagFormError({ ...base, grossWeight })).toBe(
        "Įveskite bruto svorį, didesnį už nulį.",
      );
    }
  });

  it("builds the payload with packaging, gross and location", () => {
    expect(
      toCreateBagPayload({
        packagingTypeId: "tara",
        grossWeight: " 5 ",
        warehouseLocationId: "loc",
      }),
    ).toEqual({
      packagingTypeId: "tara",
      grossWeight: "5",
      warehouseLocationId: "loc",
    });
  });
});

describe("handling-unit correction form", () => {
  const bag = {
    id: "bag-1",
    packagingTypeId: "tara-1",
    grossWeight: "26.3",
    warehouseLocationId: "loc-1",
  } as unknown as Bag;

  it("prefills the draft from the package", () => {
    expect(correctionDraftFromBag(bag)).toEqual({
      id: "bag-1",
      packagingTypeId: "tara-1",
      grossWeight: "26.3",
      warehouseLocationId: "loc-1",
    });
  });

  it("detects whether anything actually changed", () => {
    const draft = correctionDraftFromBag(bag);
    expect(correctionChanged(draft, bag)).toBe(false);
    expect(correctionChanged({ ...draft, packagingTypeId: "tara-2" }, bag)).toBe(
      true,
    );
    expect(correctionChanged({ ...draft, grossWeight: "30" }, bag)).toBe(true);
    expect(correctionChanged({ ...draft, warehouseLocationId: "loc-2" }, bag)).toBe(
      true,
    );
  });

  it("requires packaging, a location and a positive gross weight", () => {
    const draft = correctionDraftFromBag(bag);
    expect(correctionFormError(draft)).toBeNull();
    expect(correctionFormError({ ...draft, packagingTypeId: "" })).toBe(
      "Pasirinkite tarą.",
    );
    expect(correctionFormError({ ...draft, warehouseLocationId: "" })).toBe(
      "Pasirinkite sandėlio vietą.",
    );
    expect(correctionFormError({ ...draft, grossWeight: "0" })).toBe(
      "Įveskite bruto svorį, didesnį už nulį.",
    );
  });

  it("sends only changed fields; a no-op yields an empty payload", () => {
    const draft = correctionDraftFromBag(bag);
    expect(toUpdateBagPayload(draft, bag)).toEqual({});
    expect(toUpdateBagPayload({ ...draft, grossWeight: "30" }, bag)).toEqual({
      grossWeight: "30",
    });
    expect(
      toUpdateBagPayload({ ...draft, packagingTypeId: "tara-2" }, bag),
    ).toEqual({ packagingTypeId: "tara-2" });
    expect(
      toUpdateBagPayload({ ...draft, warehouseLocationId: "loc-2" }, bag),
    ).toEqual({ warehouseLocationId: "loc-2" });
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
      documentPieces: "",
      documentDate: "",
      documentNumber: "",
    });
    expect("receiptLineId" in draft).toBe(false);
  });

  it("requires a positive weight and a valid amount", () => {
    const valid = {
      documentWeight: "10",
      acquisitionAmount: "0",
      documentPieces: "",
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

  it("accepts an optional positive integer piece count and rejects invalid ones", () => {
    const valid = {
      documentWeight: "10",
      acquisitionAmount: "0",
      documentPieces: "",
      documentDate: "",
      documentNumber: "",
    };
    expect(reconciliationFormError({ ...valid, documentPieces: "500" })).toBeNull();
    expect(reconciliationFormError({ ...valid, documentPieces: "0" })).toBe(
      "Vienetų skaičius turi būti teigiamas sveikasis skaičius.",
    );
    expect(reconciliationFormError({ ...valid, documentPieces: "2.5" })).toBe(
      "Vienetų skaičius turi būti teigiamas sveikasis skaičius.",
    );
    expect(reconciliationFormError({ ...valid, documentPieces: "-3" })).toBe(
      "Vienetų skaičius turi būti teigiamas sveikasis skaičius.",
    );
  });

  it("builds a payload without the measured weight or a receipt-line id", () => {
    const payload = toReconcilePayload({
      documentWeight: " 10.5 ",
      acquisitionAmount: " 20 ",
      documentPieces: "",
      documentDate: "",
      documentNumber: "",
    });
    expect(payload).toEqual({
      documentWeight: "10.5",
      acquisitionAmount: "20",
    });
    expect("measuredWeight" in payload).toBe(false);
    expect("receiptLineId" in payload).toBe(false);
    expect("documentPieces" in payload).toBe(false);
  });

  it("includes document pieces, date and number when given", () => {
    const payload = toReconcilePayload({
      documentWeight: "10",
      acquisitionAmount: "0",
      documentPieces: "500",
      documentDate: "2026-09-20",
      documentNumber: " SF-1 ",
    });
    expect(payload.documentPieces).toBe(500);
    expect(payload.documentDate).toBeDefined();
    expect(new Date(payload.documentDate as string).getFullYear()).toBe(2026);
    expect(payload.documentNumber).toBe("SF-1");
  });
});

function item(overrides: Partial<BatchItem> = {}): BatchItem {
  return {
    id: "item-1",
    barcode: "2012345678903",
    batchId: "b1",
    batchCode: "P01",
    resourceId: "r1",
    resourceName: "Siurblys",
    warehouseLocationId: "loc-1",
    warehouseLocationName: "A1",
    quantity: 12,
    status: "ACTIVE",
    voidedById: null,
    voidedByName: null,
    voidedAt: null,
    voidReason: null,
    createdById: "u1",
    createdByName: "Vardas Pavardė",
    createdAt: "2026-10-02T09:00:00.000Z",
    updatedAt: "2026-10-02T09:00:00.000Z",
    ...overrides,
  };
}

describe("piece item form", () => {
  it("defaults to an empty draft", () => {
    expect(createDraftPieceItem()).toEqual({
      resourceId: "",
      quantity: "",
      warehouseLocationId: "",
    });
  });

  it("requires a product, a location and a positive whole quantity", () => {
    expect(pieceItemFormError(createDraftPieceItem())).toBe("Pasirinkite prekę.");
    expect(
      pieceItemFormError({
        resourceId: "r",
        quantity: "10",
        warehouseLocationId: "",
      }),
    ).toBe("Pasirinkite sandėlio vietą.");
    expect(
      pieceItemFormError({
        resourceId: "r",
        quantity: "0",
        warehouseLocationId: "loc",
      }),
    ).toBeTruthy();
    expect(
      pieceItemFormError({
        resourceId: "r",
        quantity: "1.5",
        warehouseLocationId: "loc",
      }),
    ).toBeTruthy();
    expect(
      pieceItemFormError({
        resourceId: "r",
        quantity: "120",
        warehouseLocationId: "loc",
      }),
    ).toBeNull();
  });

  it("converts the draft into a numeric create payload", () => {
    expect(
      toCreateItemPayload({
        resourceId: "r",
        quantity: " 120 ",
        warehouseLocationId: "loc",
      }),
    ).toEqual({ resourceId: "r", quantity: 120, warehouseLocationId: "loc" });
  });

  it("detects and builds a correction with only changed fields", () => {
    const existing = item();
    const draft = pieceCorrectionFromItem(existing);
    expect(pieceCorrectionChanged(draft, existing)).toBe(false);
    expect(
      pieceCorrectionChanged({ ...draft, quantity: "13" }, existing),
    ).toBe(true);
    expect(
      pieceCorrectionChanged({ ...draft, resourceId: "r2" }, existing),
    ).toBe(true);
    expect(
      toUpdateItemPayload({ ...draft, quantity: "13" }, existing),
    ).toEqual({ quantity: 13 });
    expect(
      toUpdateItemPayload({ ...draft, resourceId: "r2" }, existing),
    ).toEqual({ resourceId: "r2" });
    expect(pieceCorrectionFormError({ ...draft, quantity: "0" })).toBeTruthy();
    expect(
      pieceCorrectionFormError({ ...draft, resourceId: "" }),
    ).toBe("Pasirinkite prekę.");
  });

  it("converts a void reason into the request body", () => {
    expect(toVoidItemPayload("")).toEqual({});
    expect(toVoidItemPayload(" klaida ")).toEqual({ reason: "klaida" });
  });
});

describe("quick-create product form", () => {
  it("requires a name and a category", () => {
    expect(quickResourceFormError(createDraftQuickResource())).toBe(
      "Įveskite prekės pavadinimą.",
    );
    expect(
      quickResourceFormError({ name: "Siurblys", categoryId: "" }),
    ).toBe("Pasirinkite kategoriją.");
    expect(
      quickResourceFormError({ name: "Siurblys", categoryId: "c1" }),
    ).toBeNull();
  });

  it("builds the minimal payload", () => {
    expect(
      toQuickCreateResourcePayload({ name: " Siurblys ", categoryId: "c1" }),
    ).toEqual({ name: "Siurblys", categoryId: "c1" });
  });
});

const pieceRows: PieceConfirmationRow[] = [
  { resourceId: "r1", resourceName: "Siurblys", actualPieces: 60 },
  { resourceId: "r2", resourceName: "Lego", actualPieces: 100 },
];

describe("piece confirmation form", () => {
  it("defaults rows to 'Sutampa' with document = actual", () => {
    const products = pieceConfirmationRows(pieceRows);
    expect(products.r1).toEqual({ matches: true, documentPieces: "60" });
    expect(products.r2).toEqual({ matches: true, documentPieces: "100" });
  });

  it("derives document and difference per row", () => {
    const draft = {
      ...createDraftPieceConfirmation(),
      products: pieceConfirmationRows(pieceRows),
    };
    expect(pieceRowDocumentPieces(draft, pieceRows[0]!)).toBe(60);
    expect(pieceRowDifference(draft, pieceRows[0]!)).toBe(0);

    const short = {
      ...draft,
      products: { ...draft.products, r1: { matches: false, documentPieces: "65" } },
    };
    expect(pieceRowDifference(short, pieceRows[0]!)).toBe(-5);
    expect(pieceRowDifference(short, pieceRows[1]!)).toBe(0);

    const over = {
      ...draft,
      products: { ...draft.products, r1: { matches: false, documentPieces: "55" } },
    };
    expect(pieceRowDifference(over, pieceRows[0]!)).toBe(5);

    const invalid = {
      ...draft,
      acquisitionAmount: "0",
      products: { ...draft.products, r1: { matches: false, documentPieces: "" } },
    };
    expect(pieceRowDocumentPieces(invalid, pieceRows[0]!)).toBeNull();
    expect(
      pieceConfirmationFormError(invalid, pieceRows),
    ).toContain("Siurblys");
  });

  it("requires a non-negative acquisition amount and valid date", () => {
    expect(
      pieceConfirmationFormError(createDraftPieceConfirmation(), pieceRows),
    ).toBeTruthy();
    expect(
      pieceConfirmationFormError(
        {
          ...createDraftPieceConfirmation(),
          acquisitionAmount: "0",
        },
        pieceRows,
      ),
    ).toBeNull();
    expect(
      pieceConfirmationFormError(
        {
          ...createDraftPieceConfirmation(),
          acquisitionAmount: "1000",
          documentDate: "2026-13-01",
        },
        pieceRows,
      ),
    ).toBeTruthy();
  });

  it("builds the per-product payload and optional acknowledgement", () => {
    const draft = {
      ...createDraftPieceConfirmation(),
      acquisitionAmount: " 1250.50 ",
      documentDate: "2026-10-02",
      documentNumber: " SF-9 ",
      products: {
        r1: { matches: false, documentPieces: "65" },
        r2: { matches: true, documentPieces: "100" },
      },
    };
    const payload = toConfirmPiecePayload(draft, pieceRows, true);
    expect(payload.acquisitionAmount).toBe("1250.50");
    expect(payload.documentNumber).toBe("SF-9");
    expect(payload.documentDate).toBeDefined();
    expect(payload.acknowledgeDiscrepancies).toBe(true);
    expect(payload.products).toEqual([
      { resourceId: "r1", documentPieces: 65 },
      { resourceId: "r2", documentPieces: 100 },
    ]);
  });
});
