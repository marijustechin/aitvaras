import {
  type Bag,
  type Batch,
  type BatchDetail,
  type CreateBagRequest,
  type CreateIncomingDeliveryRequest,
  type ReconcileBatchRequest,
  type ResolveBatchRequest,
  type UpdateBagRequest,
} from "@aitvaras/contracts";

/** A delivery being created in the form (all values are strings). */
export interface DraftDelivery {
  supplierId: string;
  arrivalDate: string;
}

/** The resource/warehouse selection that starts or resolves an internal batch. */
export interface DraftResource {
  resourceId: string;
  warehouseId: string;
}

/** A physical package being registered in a batch (user-entered values are strings). */
export interface DraftBag {
  packagingTypeId: string;
  grossWeight: string;
  warehouseLocationId: string;
}

const DECIMAL = /^\d+(\.\d+)?$/;
const INTEGER = /^\d+$/;
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

/** A new delivery draft: nothing selected, arrival date defaulting to today. */
export function createDraftDelivery(): DraftDelivery {
  return { supplierId: "", arrivalDate: todayDateInput() };
}

/** Client-side validation message, or null when the delivery is submittable. */
export function deliveryFormError(draft: DraftDelivery): string | null {
  if (draft.supplierId.trim() === "") {
    return "Pasirinkite tiekėją.";
  }
  if (arrivalDateToIso(draft.arrivalDate) === null) {
    return "Įveskite teisingą priėmimo datą.";
  }
  return null;
}

/** Convert a delivery draft into the create-delivery request payload. */
export function toCreateDeliveryPayload(
  draft: DraftDelivery,
): CreateIncomingDeliveryRequest {
  const arrivalDate = arrivalDateToIso(draft.arrivalDate);
  if (!arrivalDate) {
    throw new Error("Invalid arrival date");
  }
  return { supplierId: draft.supplierId, arrivalDate };
}

/** A blank resource/warehouse selection for the next batch of a delivery. */
export function createDraftResource(): DraftResource {
  return { resourceId: "", warehouseId: "" };
}

/** Client-side validation message, or null when the resource is submittable. */
export function resourceFormError(draft: DraftResource): string | null {
  if (draft.resourceId.trim() === "") {
    return "Pasirinkite išteklių.";
  }
  if (draft.warehouseId.trim() === "") {
    return "Pasirinkite sandėlį.";
  }
  return null;
}

/** Convert the resource/warehouse selection into the resolve-batch payload. */
export function toResolveBatchPayload(draft: DraftResource): ResolveBatchRequest {
  return { resourceId: draft.resourceId, warehouseId: draft.warehouseId };
}

/** A new package draft: no packaging/weight/location. */
export function createDraftBag(): DraftBag {
  return { packagingTypeId: "", grossWeight: "", warehouseLocationId: "" };
}

/**
 * Client-side validation message, or null when the package is submittable. A
 * packaging type and a warehouse location are required and the gross weight must
 * be a positive decimal; the net weight is computed server-side (gross − tare).
 */
export function bagFormError(draft: DraftBag): string | null {
  if (draft.packagingTypeId.trim() === "") {
    return "Pasirinkite tarą.";
  }
  if (draft.warehouseLocationId.trim() === "") {
    return "Pasirinkite sandėlio vietą.";
  }
  const gross = draft.grossWeight.trim();
  if (!DECIMAL.test(gross) || Number(gross) <= 0) {
    return "Įveskite bruto svorį, didesnį už nulį.";
  }
  return null;
}

/** Convert a package draft into the create request payload. */
export function toCreateBagPayload(draft: DraftBag): CreateBagRequest {
  return {
    packagingTypeId: draft.packagingTypeId,
    grossWeight: draft.grossWeight.trim(),
    warehouseLocationId: draft.warehouseLocationId,
  };
}

/**
 * A draft for the next package of a batch: it preselects the location of the most
 * recently registered package (`BatchDetail.suggestedLocationId`), which the
 * worker may still change. There is no arbitrary fallback location.
 */
export function initialBagDraft(batch: Batch | BatchDetail): DraftBag {
  const suggestedLocationId =
    "suggestedLocationId" in batch ? batch.suggestedLocationId : null;
  const suggestedPackagingTypeId =
    "suggestedPackagingTypeId" in batch
      ? batch.suggestedPackagingTypeId
      : null;
  return {
    packagingTypeId: suggestedPackagingTypeId ?? "",
    grossWeight: "",
    warehouseLocationId: suggestedLocationId ?? "",
  };
}

/** A handling-unit correction being edited (packaging/gross/location). */
export interface DraftCorrection {
  id: string;
  packagingTypeId: string;
  grossWeight: string;
  warehouseLocationId: string;
}

/** Prefill a correction draft from the package's current values. */
export function correctionDraftFromBag(bag: Bag): DraftCorrection {
  return {
    id: bag.id,
    packagingTypeId: bag.packagingTypeId,
    grossWeight: bag.grossWeight,
    warehouseLocationId: bag.warehouseLocationId,
  };
}

/** Whether the correction draft actually differs from the package on file. */
export function correctionChanged(draft: DraftCorrection, bag: Bag): boolean {
  return (
    draft.packagingTypeId !== bag.packagingTypeId ||
    draft.grossWeight.trim() !== bag.grossWeight ||
    draft.warehouseLocationId !== bag.warehouseLocationId
  );
}

/** Client-side validation message, or null when the correction is submittable. */
export function correctionFormError(draft: DraftCorrection): string | null {
  if (draft.packagingTypeId.trim() === "") {
    return "Pasirinkite tarą.";
  }
  if (draft.warehouseLocationId.trim() === "") {
    return "Pasirinkite sandėlio vietą.";
  }
  const gross = draft.grossWeight.trim();
  if (!DECIMAL.test(gross) || Number(gross) <= 0) {
    return "Įveskite bruto svorį, didesnį už nulį.";
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
  if (draft.packagingTypeId !== bag.packagingTypeId) {
    payload.packagingTypeId = draft.packagingTypeId;
  }
  const gross = draft.grossWeight.trim();
  if (gross !== bag.grossWeight) {
    payload.grossWeight = gross;
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
  /** Optional documentary piece count (a positive whole number, or ""). */
  documentPieces: string;
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
    documentPieces: "",
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
  const pieces = draft.documentPieces.trim();
  if (pieces !== "" && (!INTEGER.test(pieces) || Number(pieces) <= 0)) {
    return "Vienetų skaičius turi būti teigiamas sveikasis skaičius.";
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
 * Convert a reconciliation draft into the request payload. The measured weight is
 * deliberately never included — the server derives it from the packages.
 * `documentPieces` is optional documentary information.
 */
export function toReconcilePayload(
  draft: DraftReconciliation,
): ReconcileBatchRequest {
  const payload: ReconcileBatchRequest = {
    documentWeight: draft.documentWeight.trim(),
    acquisitionAmount: draft.acquisitionAmount.trim(),
  };
  const pieces = draft.documentPieces.trim();
  if (pieces !== "") {
    payload.documentPieces = Number(pieces);
  }
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
