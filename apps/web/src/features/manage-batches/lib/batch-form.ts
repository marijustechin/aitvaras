import {
  DEFAULT_HANDLING_UNIT,
  type Bag,
  type Batch,
  type BatchDetail,
  type CreateBagRequest,
  type HandlingUnitKey,
  type ReconcileBatchRequest,
  type UpdateBagRequest,
} from "@aitvaras/contracts";

/** A batch being created in the form (all values are strings). */
export interface DraftBatch {
  resourceId: string;
  supplierId: string;
  warehouseId: string;
  arrivalDate: string;
}

/** A handling unit being registered in a batch (user-entered values are strings). */
export interface DraftBag {
  unit: HandlingUnitKey;
  quantity: string;
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

/** A new handling-unit draft: default unit `KG`, no quantity, no location. */
export function createDraftBag(): DraftBag {
  return {
    unit: DEFAULT_HANDLING_UNIT,
    quantity: "",
    warehouseLocationId: "",
  };
}

/**
 * Client-side validation message, or null when the unit is submittable. A
 * warehouse location is always required; `PCS` accepts whole units only (no
 * silent rounding of a fractional count).
 */
export function bagFormError(draft: DraftBag): string | null {
  if (draft.warehouseLocationId.trim() === "") {
    return "Pasirinkite sandėlio vietą.";
  }
  const quantity = draft.quantity.trim();
  if (!DECIMAL.test(quantity) || Number(quantity) <= 0) {
    return draft.unit === "PCS"
      ? "Įveskite vienetų kiekį (sveiką skaičių)."
      : "Įveskite svorį, didesnį už nulį.";
  }
  if (draft.unit === "PCS" && !/^\d+$/.test(quantity)) {
    return "Vienetų kiekis turi būti sveikas skaičius.";
  }
  return null;
}

/** Convert a handling-unit draft into the create request payload. */
export function toCreateBagPayload(draft: DraftBag): CreateBagRequest {
  return {
    unit: draft.unit,
    quantity: draft.quantity.trim(),
    warehouseLocationId: draft.warehouseLocationId,
  };
}

/**
 * A draft for the next handling unit of a batch: it inherits the batch's
 * established unit (or `KG` for a new batch) and preselects the location of the
 * most recently registered unit (`BatchDetail.suggestedLocationId`), which the
 * worker may still change. There is no arbitrary fallback location.
 */
export function initialBagDraft(batch: Batch | BatchDetail): DraftBag {
  const suggestedLocationId =
    "suggestedLocationId" in batch ? batch.suggestedLocationId : null;
  return {
    unit: batch.unit ?? DEFAULT_HANDLING_UNIT,
    quantity: "",
    warehouseLocationId: suggestedLocationId ?? "",
  };
}

/** A handling-unit correction being edited (quantity and/or location). */
export interface DraftCorrection {
  id: string;
  quantity: string;
  warehouseLocationId: string;
}

/** Prefill a correction draft from the unit's current values. */
export function correctionDraftFromBag(bag: Bag): DraftCorrection {
  return {
    id: bag.id,
    quantity: bag.quantity,
    warehouseLocationId: bag.warehouseLocationId,
  };
}

/** Whether the correction draft actually differs from the unit on file. */
export function correctionChanged(draft: DraftCorrection, bag: Bag): boolean {
  return (
    draft.quantity.trim() !== bag.quantity ||
    draft.warehouseLocationId !== bag.warehouseLocationId
  );
}

/** Client-side validation message, or null when the correction is submittable. */
export function correctionFormError(
  draft: DraftCorrection,
  unit: HandlingUnitKey,
): string | null {
  if (draft.warehouseLocationId.trim() === "") {
    return "Pasirinkite sandėlio vietą.";
  }
  const quantity = draft.quantity.trim();
  if (!DECIMAL.test(quantity) || Number(quantity) <= 0) {
    return unit === "PCS"
      ? "Įveskite vienetų kiekį (sveiką skaičių)."
      : "Įveskite svorį, didesnį už nulį.";
  }
  if (unit === "PCS" && !/^\d+$/.test(quantity)) {
    return "Vienetų kiekis turi būti sveikas skaičius.";
  }
  return null;
}

/**
 * Convert a correction draft into the update payload, sending only the fields
 * that actually changed (the server records one correction per change).
 */
export function toUpdateBagPayload(
  draft: DraftCorrection,
  bag: Bag,
): UpdateBagRequest {
  const payload: UpdateBagRequest = {};
  const quantity = draft.quantity.trim();
  if (quantity !== bag.quantity) {
    payload.quantity = quantity;
  }
  if (draft.warehouseLocationId !== bag.warehouseLocationId) {
    payload.warehouseLocationId = draft.warehouseLocationId;
  }
  return payload;
}

/** Convert an optional void reason into the void request body. */
export function toVoidBagPayload(reason: string): { reason?: string } {
  const trimmed = reason.trim();
  return trimmed === "" ? {} : { reason: trimmed };
}

/**
 * A batch reconciliation form (all values are strings). Formal/business data
 * only — the internal receipt-line anchor is resolved server-side.
 */
export interface DraftReconciliation {
  documentWeight: string;
  acquisitionAmount: string;
  /** Optional document date, `yyyy-mm-dd` from a date input. */
  documentDate: string;
  /** Optional document number. */
  documentNumber: string;
}

/** A blank reconciliation draft. */
export function createDraftReconciliation(): DraftReconciliation {
  return {
    documentWeight: "",
    acquisitionAmount: "",
    documentDate: "",
    documentNumber: "",
  };
}

/** Client-side validation message, or null when reconciliation is submittable. */
export function reconciliationFormError(
  draft: DraftReconciliation,
): string | null {
  const weight = draft.documentWeight.trim();
  if (!DECIMAL.test(weight) || Number(weight) <= 0) {
    return "Įveskite dokumentinį svorį, didesnį už nulį.";
  }
  if (!DECIMAL.test(draft.acquisitionAmount.trim())) {
    return "Įveskite įsigijimo vertę (gali būti 0).";
  }
  if (
    draft.documentDate.trim() !== "" &&
    arrivalDateToIso(draft.documentDate) === null
  ) {
    return "Įveskite teisingą dokumento datą.";
  }
  return null;
}

/**
 * Convert a reconciliation draft into the request payload. The measured total is
 * deliberately never included — the server derives it from the bags.
 */
export function toReconcilePayload(
  draft: DraftReconciliation,
): ReconcileBatchRequest {
  const payload: ReconcileBatchRequest = {
    documentWeight: draft.documentWeight.trim(),
    acquisitionAmount: draft.acquisitionAmount.trim(),
  };
  const documentDate = arrivalDateToIso(draft.documentDate);
  if (documentDate) {
    payload.documentDate = documentDate;
  }
  const documentNumber = draft.documentNumber.trim();
  if (documentNumber !== "") {
    payload.documentNumber = documentNumber;
  }
  return payload;
}
