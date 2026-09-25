import {
  DEFAULT_MEASUREMENT_UNIT,
  type MeasurementUnitKey,
} from "@aitvaras/contracts";

/** A receipt line being edited in the create form (all values are strings). */
export interface DraftReceiptLine {
  key: string;
  resourceId: string;
  quantity: string;
  unit: MeasurementUnitKey;
  unitPrice: string;
  warehouseId: string;
  warehouseLocationId: string;
}

/** The receipt being created (one supplier partner + 1..n lines). */
export interface DraftReceipt {
  partnerId: string;
  lines: DraftReceiptLine[];
}

const DECIMAL = /^\d+(\.\d+)?$/;

function newLineKey(): string {
  return globalThis.crypto?.randomUUID?.() ??
    `line-${Math.random().toString(36).slice(2)}`;
}

/** One blank line; the measurement unit defaults to KG. */
export function emptyDraftLine(): DraftReceiptLine {
  return {
    key: newLineKey(),
    resourceId: "",
    quantity: "",
    unit: DEFAULT_MEASUREMENT_UNIT,
    unitPrice: "",
    warehouseId: "",
    warehouseLocationId: "",
  };
}

/** A new receipt draft: no partner yet and exactly one empty line. */
export function createDraftReceipt(): DraftReceipt {
  return { partnerId: "", lines: [emptyDraftLine()] };
}

export function addDraftLine(draft: DraftReceipt): DraftReceipt {
  return { ...draft, lines: [...draft.lines, emptyDraftLine()] };
}

/** Remove a line, but never below one line. */
export function removeDraftLine(
  draft: DraftReceipt,
  key: string,
): DraftReceipt {
  if (draft.lines.length <= 1) {
    return draft;
  }
  return { ...draft, lines: draft.lines.filter((line) => line.key !== key) };
}

export function updateDraftLine(
  draft: DraftReceipt,
  key: string,
  patch: Partial<Omit<DraftReceiptLine, "key">>,
): DraftReceipt {
  return {
    ...draft,
    lines: draft.lines.map((line) =>
      line.key === key ? { ...line, ...patch } : line,
    ),
  };
}

/**
 * Change a line's warehouse and clear its location — a location only makes
 * sense within the newly selected warehouse.
 */
export function setDraftLineWarehouse(
  draft: DraftReceipt,
  key: string,
  warehouseId: string,
): DraftReceipt {
  return updateDraftLine(draft, key, {
    warehouseId,
    warehouseLocationId: "",
  });
}

/**
 * Display-only line total (quantity × unit price). Not authoritative — the API
 * derives stored totals from persisted decimals.
 */
export function draftLineTotal(line: DraftReceiptLine): number | null {
  const quantity = line.quantity.trim();
  const unitPrice = line.unitPrice.trim();
  if (!DECIMAL.test(quantity) || !DECIMAL.test(unitPrice)) {
    return null;
  }
  return Number(quantity) * Number(unitPrice);
}

/** Display-only receipt total across all lines. */
export function draftTotal(draft: DraftReceipt): number {
  return draft.lines.reduce(
    (sum, line) => sum + (draftLineTotal(line) ?? 0),
    0,
  );
}

/** Client-side validation message, or null when the draft is submittable. */
export function receiptFormError(draft: DraftReceipt): string | null {
  if (draft.partnerId.trim() === "") {
    return "Pasirinkite tiekėją.";
  }
  if (draft.lines.length === 0) {
    return "Pridėkite bent vieną eilutę.";
  }
  for (const line of draft.lines) {
    if (line.resourceId.trim() === "") {
      return "Kiekvienoje eilutėje pasirinkite išteklių.";
    }
    const quantity = line.quantity.trim();
    if (!DECIMAL.test(quantity) || Number(quantity) <= 0) {
      return "Įveskite kiekį, didesnį už nulį.";
    }
    if (!DECIMAL.test(line.unitPrice.trim())) {
      return "Įveskite vieneto kainą.";
    }
    if (line.warehouseId.trim() === "") {
      return "Kiekvienoje eilutėje pasirinkite sandėlį.";
    }
  }
  return null;
}

/** Convert a draft into the create-receipt request payload. */
export function toCreateReceiptPayload(draft: DraftReceipt): {
  partnerId: string;
  lines: {
    resourceId: string;
    quantity: string;
    unit: MeasurementUnitKey;
    unitPrice: string;
    warehouseId: string;
    warehouseLocationId: string;
  }[];
} {
  return {
    partnerId: draft.partnerId,
    lines: draft.lines.map((line) => ({
      resourceId: line.resourceId,
      quantity: line.quantity.trim(),
      unit: line.unit,
      unitPrice: line.unitPrice.trim(),
      warehouseId: line.warehouseId,
      warehouseLocationId: line.warehouseLocationId,
    })),
  };
}
