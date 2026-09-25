import { describe, expect, it } from "vitest";
import {
  addDraftLine,
  createDraftReceipt,
  draftLineTotal,
  draftTotal,
  emptyDraftLine,
  receiptFormError,
  removeDraftLine,
  setDraftLineWarehouse,
  toCreateReceiptPayload,
  updateDraftLine,
} from "./receipt-form";

const RESOURCE = "22222222-2222-4222-8222-222222222222";
const PARTNER = "11111111-1111-4111-8111-111111111111";
const WAREHOUSE = "33333333-3333-4333-8333-333333333333";
const LOCATION = "44444444-4444-4444-8444-444444444444";

describe("draft lines", () => {
  it("defaults a new line unit to KG", () => {
    expect(emptyDraftLine().unit).toBe("KG");
  });

  it("starts with exactly one line", () => {
    expect(createDraftReceipt().lines).toHaveLength(1);
  });

  it("can add and remove lines but never below one", () => {
    let draft = createDraftReceipt();
    draft = addDraftLine(draft);
    expect(draft.lines).toHaveLength(2);

    const removed = removeDraftLine(draft, draft.lines[1]!.key);
    expect(removed.lines).toHaveLength(1);

    const stillOne = removeDraftLine(removed, removed.lines[0]!.key);
    expect(stillOne.lines).toHaveLength(1);
  });
});

describe("totals (display convenience)", () => {
  it("calculates quantity × unit price", () => {
    const line = { ...emptyDraftLine(), quantity: "1250", unitPrice: "1.42" };
    expect(draftLineTotal(line)).toBeCloseTo(1775, 6);
  });

  it("returns null for incomplete input", () => {
    expect(draftLineTotal(emptyDraftLine())).toBeNull();
  });

  it("sums all lines", () => {
    let draft = createDraftReceipt();
    draft = updateDraftLine(draft, draft.lines[0]!.key, {
      quantity: "2",
      unitPrice: "10",
    });
    draft = addDraftLine(draft);
    draft = updateDraftLine(draft, draft.lines[1]!.key, {
      quantity: "3",
      unitPrice: "2.5",
    });
    expect(draftTotal(draft)).toBeCloseTo(27.5, 6);
  });
});

describe("receiptFormError", () => {
  function valid() {
    let draft = createDraftReceipt();
    draft = { ...draft, partnerId: PARTNER };
    draft = updateDraftLine(draft, draft.lines[0]!.key, {
      resourceId: RESOURCE,
      quantity: "12.5",
      unitPrice: "3.5",
      warehouseId: WAREHOUSE,
      warehouseLocationId: LOCATION,
    });
    return draft;
  }

  it("accepts a complete draft", () => {
    expect(receiptFormError(valid())).toBeNull();
  });

  it("requires a partner, a resource and a positive quantity and price", () => {
    expect(receiptFormError(createDraftReceipt())).toBe("Pasirinkite tiekėją.");

    const base = valid();
    expect(receiptFormError({ ...base, partnerId: "" })).toBe(
      "Pasirinkite tiekėją.",
    );
    expect(
      receiptFormError(
        updateDraftLine(base, base.lines[0]!.key, { resourceId: "" }),
      ),
    ).toBe("Kiekvienoje eilutėje pasirinkite išteklių.");
    expect(
      receiptFormError(
        updateDraftLine(base, base.lines[0]!.key, { quantity: "0" }),
      ),
    ).toBe("Įveskite kiekį, didesnį už nulį.");
    expect(
      receiptFormError(
        updateDraftLine(base, base.lines[0]!.key, { unitPrice: "" }),
      ),
    ).toBe("Įveskite vieneto kainą.");
    expect(
      receiptFormError(
        updateDraftLine(base, base.lines[0]!.key, { warehouseId: "" }),
      ),
    ).toBe("Kiekvienoje eilutėje pasirinkite sandėlį.");
  });

  it("accepts a line with a warehouse but no location", () => {
    const base = valid();
    expect(
      receiptFormError(
        updateDraftLine(base, base.lines[0]!.key, { warehouseLocationId: "" }),
      ),
    ).toBeNull();
  });
});

describe("toCreateReceiptPayload", () => {
  it("trims values and keeps the selected unit and placement", () => {
    let draft = createDraftReceipt();
    draft = { ...draft, partnerId: PARTNER };
    draft = updateDraftLine(draft, draft.lines[0]!.key, {
      resourceId: RESOURCE,
      quantity: " 24 ",
      unit: "UNIT",
      unitPrice: " 3.50 ",
      warehouseId: WAREHOUSE,
      warehouseLocationId: LOCATION,
    });
    expect(toCreateReceiptPayload(draft)).toEqual({
      partnerId: PARTNER,
      lines: [
        {
          resourceId: RESOURCE,
          quantity: "24",
          unit: "UNIT",
          unitPrice: "3.50",
          warehouseId: WAREHOUSE,
          warehouseLocationId: LOCATION,
        },
      ],
    });
  });

  it("produces a valid payload with a warehouse and no location", () => {
    let draft = createDraftReceipt();
    draft = { ...draft, partnerId: PARTNER };
    draft = updateDraftLine(draft, draft.lines[0]!.key, {
      resourceId: RESOURCE,
      quantity: "1",
      unitPrice: "1",
      warehouseId: WAREHOUSE,
    });
    const payload = toCreateReceiptPayload(draft);
    expect(payload.lines[0]?.warehouseId).toBe(WAREHOUSE);
    expect(payload.lines[0]?.warehouseLocationId).toBe("");
    expect(receiptFormError(draft)).toBeNull();
  });
});

describe("setDraftLineWarehouse", () => {
  it("clears the location when the warehouse changes", () => {
    let draft = createDraftReceipt();
    draft = updateDraftLine(draft, draft.lines[0]!.key, {
      warehouseId: WAREHOUSE,
      warehouseLocationId: LOCATION,
    });
    const changed = setDraftLineWarehouse(draft, draft.lines[0]!.key, "other");
    expect(changed.lines[0]!.warehouseId).toBe("other");
    expect(changed.lines[0]!.warehouseLocationId).toBe("");
  });

  it("keeps each line's placement independent", () => {
    let draft = createDraftReceipt();
    draft = setDraftLineWarehouse(draft, draft.lines[0]!.key, WAREHOUSE);
    draft = addDraftLine(draft);
    draft = setDraftLineWarehouse(draft, draft.lines[1]!.key, "other");
    expect(draft.lines[0]!.warehouseId).toBe(WAREHOUSE);
    expect(draft.lines[1]!.warehouseId).toBe("other");
  });
});
