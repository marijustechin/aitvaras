import {
  type Bag,
  type BatchItem,
  type BatchReceivingMode,
  type ConfirmPieceBatchRequest,
  type CreateBagRequest,
  type CreateBatchItemRequest,
  type CreateIncomingDeliveryRequest,
  type QuickCreateResourceRequest,
  type ReconcileBatchRequest,
  type ResolveBatchRequest,
  type UpdateBagRequest,
  type UpdateBatchItemRequest,
} from "@aitvaras/contracts";
import {
  dateOnlyToLocalIso,
  todayDateOnly,
} from "@/shared/lib/date";

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

/** Documentary weight must be a positive decimal (`0` is not valid). */
export function isDocumentaryWeightValid(value: string): boolean {
  const weight = value.trim();
  return DECIMAL.test(weight) && Number(weight) > 0;
}

/** Acquisition amount must be a non-negative decimal (`0` is valid). */
export function isAcquisitionAmountValid(value: string): boolean {
  return DECIMAL.test(value.trim());
}

/** Documentary piece count must be a non-negative whole number (`0` is valid). */
export function isPieceCountValid(value: string): boolean {
  return INTEGER.test(value.trim());
}

/**
 * Convert a date-only `yyyy-mm-dd` value to an ISO datetime at local start of
 * day, or null when the value is not a valid date.
 */
export function arrivalDateToIso(value: string): string | null {
  return dateOnlyToLocalIso(value);
}

/** A new delivery draft: nothing selected, arrival date defaulting to today. */
export function createDraftDelivery(): DraftDelivery {
  return { supplierId: "", arrivalDate: todayDateOnly() };
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

/**
 * Client-side validation message, or null when the batch start is submittable.
 * A warehouse is always required; a resource only for a `WEIGHT` batch (a
 * `PIECE` batch owns no batch-level resource).
 */
export function resourceFormError(
  draft: DraftResource,
  receivingMode: BatchReceivingMode = "WEIGHT",
): string | null {
  if (receivingMode === "WEIGHT" && draft.resourceId.trim() === "") {
    return "Pasirinkite išteklių.";
  }
  if (draft.warehouseId.trim() === "") {
    return "Pasirinkite sandėlį.";
  }
  return null;
}

/** Convert the selection into the resolve-batch payload (mode-aware). */
export function toResolveBatchPayload(
  draft: DraftResource,
  receivingMode: BatchReceivingMode = "WEIGHT",
): ResolveBatchRequest {
  if (receivingMode === "PIECE") {
    return { receivingMode, warehouseId: draft.warehouseId };
  }
  return {
    receivingMode,
    resourceId: draft.resourceId,
    warehouseId: draft.warehouseId,
  };
}

/** A PIECE item line being entered (user-entered values are strings). */
export interface DraftPieceItem {
  resourceId: string;
  quantity: string;
  warehouseLocationId: string;
}

/** A blank PIECE item draft. */
export function createDraftPieceItem(): DraftPieceItem {
  return { resourceId: "", quantity: "", warehouseLocationId: "" };
}

/** Client-side validation message, or null when the item is submittable. */
export function pieceItemFormError(draft: DraftPieceItem): string | null {
  if (draft.resourceId.trim() === "") {
    return "Pasirinkite prekę.";
  }
  if (draft.warehouseLocationId.trim() === "") {
    return "Pasirinkite sandėlio vietą.";
  }
  const quantity = draft.quantity.trim();
  if (!INTEGER.test(quantity) || Number(quantity) <= 0) {
    return "Kiekis turi būti teigiamas sveikasis skaičius.";
  }
  return null;
}

/** Convert a piece-item draft into the create request payload. */
export function toCreateItemPayload(draft: DraftPieceItem): CreateBatchItemRequest {
  return {
    resourceId: draft.resourceId,
    warehouseLocationId: draft.warehouseLocationId,
    quantity: Number(draft.quantity.trim()),
  };
}

/** A PIECE item line being corrected (resource, quantity/location). */
export interface DraftPieceCorrection {
  id: string;
  resourceId: string;
  quantity: string;
  warehouseLocationId: string;
}

/** Prefill a correction draft from the item's current values. */
export function pieceCorrectionFromItem(item: BatchItem): DraftPieceCorrection {
  return {
    id: item.id,
    resourceId: item.resourceId,
    quantity: String(item.quantity),
    warehouseLocationId: item.warehouseLocationId,
  };
}

/** Whether the correction draft actually differs from the item on file. */
export function pieceCorrectionChanged(
  draft: DraftPieceCorrection,
  item: BatchItem,
): boolean {
  return (
    draft.resourceId !== item.resourceId ||
    draft.quantity.trim() !== String(item.quantity) ||
    draft.warehouseLocationId !== item.warehouseLocationId
  );
}

/** Client-side validation message, or null when the correction is submittable. */
export function pieceCorrectionFormError(
  draft: DraftPieceCorrection,
): string | null {
  if (draft.resourceId.trim() === "") {
    return "Pasirinkite prekę.";
  }
  if (draft.warehouseLocationId.trim() === "") {
    return "Pasirinkite sandėlio vietą.";
  }
  const quantity = draft.quantity.trim();
  if (!INTEGER.test(quantity) || Number(quantity) <= 0) {
    return "Kiekis turi būti teigiamas sveikasis skaičius.";
  }
  return null;
}

/** Convert a correction draft into the update payload (only changed fields). */
export function toUpdateItemPayload(
  draft: DraftPieceCorrection,
  item: BatchItem,
): UpdateBatchItemRequest {
  const payload: UpdateBatchItemRequest = {};
  if (draft.resourceId !== item.resourceId) {
    payload.resourceId = draft.resourceId;
  }
  if (draft.quantity.trim() !== String(item.quantity)) {
    payload.quantity = Number(draft.quantity.trim());
  }
  if (draft.warehouseLocationId !== item.warehouseLocationId) {
    payload.warehouseLocationId = draft.warehouseLocationId;
  }
  return payload;
}

/** Convert an optional void reason into the item void request body. */
export function toVoidItemPayload(reason: string): { reason?: string } {
  const trimmed = reason.trim();
  return trimmed === "" ? {} : { reason: trimmed };
}

/** How a PIECE document provides its documentary quantity. */
export type PieceDocumentaryMode = "ITEMISED" | "TOTAL";

/** A product row for PIECE reconciliation (server-derived actual pieces). */
export interface PieceConfirmationRow {
  resourceId: string;
  resourceName: string;
  actualPieces: number;
}

/** A PIECE batch confirmation draft (itemised or single total). */
export interface DraftPieceConfirmation {
  mode: PieceDocumentaryMode;
  /** Single total, used when `mode === "TOTAL"`. */
  documentPieces: string;
  /** Per-resource documentary input, used when `mode === "ITEMISED"`. */
  products: Record<string, string>;
  acquisitionAmount: string;
  documentDate: string;
  documentNumber: string;
}

/** Default mode: multi-product documents are itemised; single-product ones total. */
export function defaultPieceDocumentaryMode(
  rows: readonly PieceConfirmationRow[],
): PieceDocumentaryMode {
  return rows.length > 1 ? "ITEMISED" : "TOTAL";
}

/** A blank PIECE confirmation draft. */
export function createDraftPieceConfirmation(
  mode: PieceDocumentaryMode = "TOTAL",
): DraftPieceConfirmation {
  return {
    mode,
    documentPieces: "",
    products: {},
    acquisitionAmount: "",
    documentDate: "",
    documentNumber: "",
  };
}

/** A row's entered documentary value (empty when not entered yet). */
export function pieceRowDraftValue(
  draft: DraftPieceConfirmation,
  row: PieceConfirmationRow,
): string {
  return draft.products[row.resourceId] ?? "";
}

/** Signed `actual − documentary` pieces for a row, or null when not entered. */
export function pieceRowDifference(
  draft: DraftPieceConfirmation,
  row: PieceConfirmationRow,
): number | null {
  const value = pieceRowDraftValue(draft, row).trim();
  if (!isPieceCountValid(value)) {
    return null;
  }
  return row.actualPieces - Number(value);
}

/**
 * Signed total `actual − documentary` pieces for the single-total mode, or null
 * while the field is empty/invalid.
 */
export function pieceConfirmationDifference(
  actualPieces: number,
  draft: DraftPieceConfirmation,
): number | null {
  const value = draft.documentPieces.trim();
  if (!isPieceCountValid(value)) {
    return null;
  }
  return actualPieces - Number(value);
}

/** Client-side validation message, or null when confirmation is submittable. */
export function pieceConfirmationFormError(
  draft: DraftPieceConfirmation,
  rows: readonly PieceConfirmationRow[],
): string | null {
  if (draft.mode === "ITEMISED") {
    for (const row of rows) {
      const value = pieceRowDraftValue(draft, row).trim();
      if (!isPieceCountValid(value)) {
        return `Įveskite ${row.resourceName} dokumentinį kiekį (sveikasis skaičius).`;
      }
    }
  } else {
    const pieces = draft.documentPieces.trim();
    if (!isPieceCountValid(pieces)) {
      return "Įveskite dokumentinį kiekį (sveikasis skaičius).";
    }
  }
  if (!isAcquisitionAmountValid(draft.acquisitionAmount)) {
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

/** Convert a PIECE confirmation draft into the request payload. */
export function toConfirmPiecePayload(
  draft: DraftPieceConfirmation,
  rows: readonly PieceConfirmationRow[],
  acknowledgeDiscrepancies: boolean,
): ConfirmPieceBatchRequest {
  const payload: ConfirmPieceBatchRequest = {
    acquisitionAmount: draft.acquisitionAmount.trim(),
  };
  if (draft.mode === "ITEMISED") {
    payload.products = rows.map((row) => ({
      resourceId: row.resourceId,
      documentPieces: Number(pieceRowDraftValue(draft, row).trim()),
    }));
  } else {
    payload.documentPieces = Number(draft.documentPieces.trim());
  }
  if (acknowledgeDiscrepancies) {
    payload.acknowledgeDiscrepancies = true;
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

/** A missing product being quick-created from the receiving flow. */
export interface DraftQuickResource {
  name: string;
  categoryId: string;
}

/** A blank quick-create product draft. */
export function createDraftQuickResource(): DraftQuickResource {
  return { name: "", categoryId: "" };
}

/** Client-side validation message, or null when quick-create is submittable. */
export function quickResourceFormError(
  draft: DraftQuickResource,
): string | null {
  if (draft.name.trim() === "") {
    return "Įveskite prekės pavadinimą.";
  }
  if (draft.categoryId.trim() === "") {
    return "Pasirinkite kategoriją.";
  }
  return null;
}

/** Convert a quick-create draft into the request payload. */
export function toQuickCreateResourcePayload(
  draft: DraftQuickResource,
): QuickCreateResourceRequest {
  return { name: draft.name.trim(), categoryId: draft.categoryId };
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
  if (!isDocumentaryWeightValid(weight)) {
    return "Įveskite dokumentinį svorį, didesnį už nulį.";
  }
  if (!isAcquisitionAmountValid(draft.acquisitionAmount)) {
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
 * Convert a reconciliation draft into the request payload. The measured weight is
 * deliberately never included — the server derives it from the packages.
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
