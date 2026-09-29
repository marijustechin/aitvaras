import type { CreateBagRequest } from "@aitvaras/contracts";

/** A batch being created in the form (all values are strings). */
export interface DraftBatch {
  resourceId: string;
  supplierId: string;
  warehouseId: string;
  arrivalDate: string;
}

/** A bag being added to a batch (all values are strings). */
export interface DraftBag {
  weight: string;
  warehouseLocationId: string;
}

const DECIMAL = /^\d+(\.\d+)?$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function todayDateInput(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Convert a `<input type="date">` value (yyyy-mm-dd) to an ISO datetime at local
 * start of day, or null when the value is not a valid date.
 */
export function arrivalDateToIso(value: string): string | null {
  const match = DATE.exec(value.trim());
  if (!match) {
    return null;
  }
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    return null;
  }
  return date.toISOString();
}

/** A new batch draft: nothing selected, arrival date defaulting to today. */
export function createDraftBatch(): DraftBatch {
  return {
    resourceId: "",
    supplierId: "",
    warehouseId: "",
    arrivalDate: todayDateInput(),
  };
}

/** Client-side validation message, or null when the batch is submittable. */
export function batchFormError(draft: DraftBatch): string | null {
  if (draft.resourceId.trim() === "") {
    return "Pasirinkite išteklių.";
  }
  if (draft.supplierId.trim() === "") {
    return "Pasirinkite tiekėją.";
  }
  if (draft.warehouseId.trim() === "") {
    return "Pasirinkite sandėlį.";
  }
  if (arrivalDateToIso(draft.arrivalDate) === null) {
    return "Įveskite teisingą priėmimo datą.";
  }
  return null;
}

/** Convert a batch draft into the create-batch request payload. */
export function toCreateBatchPayload(draft: DraftBatch): {
  resourceId: string;
  supplierId: string;
  warehouseId: string;
  arrivalDate: string;
} {
  const arrivalDate = arrivalDateToIso(draft.arrivalDate);
  if (!arrivalDate) {
    throw new Error("Invalid arrival date");
  }
  return {
    resourceId: draft.resourceId,
    supplierId: draft.supplierId,
    warehouseId: draft.warehouseId,
    arrivalDate,
  };
}

/** A new bag draft: empty weight, no specific location. */
export function createDraftBag(): DraftBag {
  return { weight: "", warehouseLocationId: "" };
}

/** Client-side validation message, or null when the bag is submittable. */
export function bagFormError(draft: DraftBag): string | null {
  const weight = draft.weight.trim();
  if (!DECIMAL.test(weight) || Number(weight) <= 0) {
    return "Įveskite svorį, didesnį už nulį.";
  }
  return null;
}

/** Convert a bag draft into the add-bag request payload. */
export function toCreateBagPayload(draft: DraftBag): CreateBagRequest {
  return {
    weight: draft.weight.trim(),
    warehouseLocationId:
      draft.warehouseLocationId.trim() === "" ? undefined : draft.warehouseLocationId,
  };
}
