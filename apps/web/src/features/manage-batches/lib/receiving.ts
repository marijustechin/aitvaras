import type {
  Bag,
  Batch,
  BatchDetail,
  BatchItem,
  IncomingDelivery,
  IncomingDeliveryDetail,
} from "@aitvaras/contracts";
import {
  createDraftBag,
  createDraftResource,
  type DraftBag,
  type DraftResource,
} from "./batch-form";

/** Label for the "start a new receipt" action. */
export const NEW_DELIVERY_LABEL = "Naujas priėmimas";

/** Heading of the receipt header form. */
export const DELIVERY_FORM_HEADING = "Priėmimo informacija";

/** Primary action of the delivery header form. */
export const START_DELIVERY_LABEL = "Pradėti priėmimą";

/** Action that resolves/creates the internal batch for the chosen resource. */
export const START_RESOURCE_LABEL = "Pradėti registruoti";

/** Heading of the compact summary of batches already in the receipt. */
export const DELIVERY_CONTENTS_HEADING = "Priėmimo turinys";

/** Empty-state text when the receipt has no resource batches yet. */
export const EMPTY_DELIVERY_CONTENTS_MESSAGE =
  "Šiame priėmime dar nėra užregistruotų išteklių.";

/** Save-only action: create the package and return to the form (no label/print). */
export const SAVE_LABEL = "Išsaugoti";

/** Save-and-print action: create the package, open the label and print it. */
export const SAVE_AND_PRINT_LABEL = "Išsaugoti ir spausdinti";

/**
 * The only inputs the warehouse worker enters per package, in form order.
 * Documentary/financial fields (see `FORMAL_RECONCILIATION_FIELDS`) are never
 * part of this form.
 */
export const BAG_RECEIVING_FIELDS = [
  "packagingTypeId",
  "warehouseLocationId",
  "grossWeight",
] as const;
export type BagReceivingField = (typeof BAG_RECEIVING_FIELDS)[number];

/** The resource/warehouse selection that starts an internal batch. */
export const RESOURCE_SELECTION_FIELDS = ["resourceId", "warehouseId"] as const;
export type ResourceSelectionField = (typeof RESOURCE_SELECTION_FIELDS)[number];

/**
 * Fields that belong **only** to the formal ADMIN reconciliation flow and must
 * never be shown in the warehouse receiving flow.
 */
export const FORMAL_RECONCILIATION_FIELDS = [
  "documentWeight",
  "documentPieces",
  "acquisitionAmount",
  "documentNumber",
  "documentDate",
  "receiptLineId",
  "confirmedAt",
] as const;
export type FormalReconciliationField =
  (typeof FORMAL_RECONCILIATION_FIELDS)[number];

/** The delivery context shown to the worker (no formal/documentary values). */
export const DELIVERY_CONTEXT_FIELDS = [
  "code",
  "supplierName",
  "arrivalDate",
  "batchCount",
] as const;
export type DeliveryContextField = (typeof DELIVERY_CONTEXT_FIELDS)[number];

/** Back/navigation action on a receipt screen (returns to the receipt list). */
export const DELIVERIES_LIST_BACK_LABEL = "← Priėmimų sąrašas";

/** Parent-receipt action when the operator may still edit the receipt. */
export const EDIT_DELIVERY_LABEL = "Redaguoti priėmimą";

/** Parent-receipt action when the operator has read-only access. */
export const VIEW_DELIVERY_LABEL = "Peržiūrėti priėmimą";

/** The internal batches of a delivery, in registration order. */
export function deliveryBatches(
  delivery: Pick<IncomingDeliveryDetail, "batches">,
): Batch[] {
  return [...delivery.batches].sort((a, b) => {
    const byDate = a.createdAt.localeCompare(b.createdAt);
    return byDate !== 0 ? byDate : a.id.localeCompare(b.id);
  });
}

/**
 * The data printed on a package label. The barcode is the only machine value
 * (opaque physical-package identifier); everything else is human-readable
 * metadata and is never encoded into the barcode. The delivery code is the
 * prominent human-facing reference; the warehouse belongs to the batch; the
 * measured value is an actual weight (no PCS unit).
 */
export interface BagLabelData {
  deliveryCode: string;
  warehouseName: string;
  locationName: string;
  categoryName: string;
  resourceName: string;
  tareWeightKg: string;
  grossWeight: string;
  netWeight: string;
  barcode: string;
}

export function bagLabelData(
  delivery: Pick<IncomingDelivery, "code">,
  batch: Pick<Batch, "resourceName" | "resourceCategoryName" | "warehouseName">,
  bag: Pick<
    Bag,
    | "barcode"
    | "grossWeight"
    | "netWeight"
    | "tareWeightKg"
    | "warehouseLocationName"
  >,
): BagLabelData {
  return {
    deliveryCode: delivery.code,
    warehouseName: batch.warehouseName,
    locationName: bag.warehouseLocationName,
    categoryName: batch.resourceCategoryName ?? "",
    resourceName: batch.resourceName ?? "",
    tareWeightKg: bag.tareWeightKg,
    grossWeight: bag.grossWeight,
    netWeight: bag.netWeight,
    barcode: bag.barcode,
  };
}

/**
 * The surface shown while receiving: the entry `form`, or the `label` of the
 * package that was just saved. There is deliberately **no** intermediate `detail`
 * surface.
 */
/** The full warehouse receiving state while a delivery is open. */
export interface ReceivingState {
  /** The open delivery (with its batches), or null before one is chosen. */
  delivery: IncomingDeliveryDetail | null;
  /** The resource/warehouse selection that starts or resolves a batch. */
  resource: DraftResource;
  /** The batch currently being filled; null until a resource is resolved. */
  batch: BatchDetail | null;
  /** The package entry draft for the active batch. */
  draft: DraftBag;
  /** The package whose label is open; null means the entry form is shown. */
  label: Bag | null;
}

export function initialReceivingState(): ReceivingState {
  return {
    delivery: null,
    resource: createDraftResource(),
    batch: null,
    draft: createDraftBag(),
    label: null,
  };
}

/** Open a delivery: show its header and start on the resource selection. */
export function enterDelivery(
  delivery: IncomingDeliveryDetail,
): ReceivingState {
  return {
    delivery,
    resource: createDraftResource(),
    batch: null,
    draft: createDraftBag(),
    label: null,
  };
}

/**
 * Make a resolved batch active: lock the resource/warehouse, prefill the package
 * draft from the batch's suggested location, and show the entry form.
 */
export function enterBatch(
  state: ReceivingState,
  batch: BatchDetail,
): ReceivingState {
  return {
    ...state,
    resource: { resourceId: batch.resourceId ?? "", warehouseId: batch.warehouseId },
    batch,
    draft: initialUnitDraft(batch),
    label: null,
  };
}

/**
 * A successful save: open the saved package's label and prepare the next draft.
 * The batch is preserved, the package is kept, the last-used location stays
 * suggested and only the weight is reset.
 */
export function applyUnitSaved(
  state: ReceivingState,
  batch: BatchDetail,
  bag: Bag,
): ReceivingState {
  return {
    ...state,
    resource: { resourceId: batch.resourceId ?? "", warehouseId: batch.warehouseId },
    batch,
    draft: initialUnitDraft(batch),
    label: bag,
  };
}

/**
 * A successful **save-only**: refresh the batch and return to the entry form
 * with the next draft (same batch/last location, weight reset) and **no** label
 * surface.
 */
export function applyUnitSavedSilently(
  state: ReceivingState,
  batch: BatchDetail,
): ReceivingState {
  return {
    ...state,
    resource: { resourceId: batch.resourceId ?? "", warehouseId: batch.warehouseId },
    batch,
    draft: initialUnitDraft(batch),
    label: null,
  };
}

/** A failed save: keep the draft untouched and never open a label. */
export function applyUnitSaveFailed(state: ReceivingState): ReceivingState {
  return { ...state, label: null };
}

/** Close the label and return to the entry form (batch + next draft preserved). */
export function closeLabel(state: ReceivingState): ReceivingState {
  return { ...state, label: null };
}

/** Label of the batch-type selector when starting a new batch. */
export const BATCH_TYPE_LABEL = "Partijos tipas";

/** Explicit action that starts another batch in the delivery. */
export const NEW_BATCH_LABEL = "Nauja partija";

/** Column/action labels for a PIECE inventory group. */
export const PIECE_BARCODE_LABEL = "Barkodas";
export const PIECE_LABEL_ACTION = "Etiketė";
export const PRINT_LABEL = "Spausdinti";

/** The data printed on a PIECE inventory-group label. */
export interface PieceLabelData {
  deliveryCode: string;
  batchCode: string;
  resourceName: string;
  quantity: number;
  warehouseName: string;
  locationName: string;
  barcode: string;
}

/**
 * Build the printable label for a PIECE inventory group. The barcode is the only
 * machine value (an opaque group identifier); everything else is human-readable.
 */
export function pieceLabelData(
  delivery: Pick<IncomingDelivery, "code">,
  batch: Pick<Batch, "code" | "warehouseName">,
  item: Pick<
    BatchItem,
    "resourceName" | "quantity" | "warehouseLocationName" | "barcode"
  >,
): PieceLabelData {
  return {
    deliveryCode: delivery.code,
    batchCode: batch.code,
    resourceName: item.resourceName,
    quantity: item.quantity,
    warehouseName: batch.warehouseName,
    locationName: item.warehouseLocationName,
    barcode: item.barcode,
  };
}

/** Heading shown inside a PIECE batch being filled. */
export const PIECE_BATCH_HEADING = "Vienetinė partija";

/** Heading of the PIECE item list. */
export const PIECE_ITEMS_HEADING = "Prekės";

/** PIECE item form labels. */
export const ITEM_RESOURCE_LABEL = "Prekė";
export const ITEM_QUANTITY_LABEL = "Kiekis, vnt.";
export const ITEM_LOCATION_LABEL = "Vieta";
export const ITEMS_TOTAL_LABEL = "Iš viso";
export const NEW_PRODUCT_LABEL = "+ Nauja prekė";

/** Action that opens the inline correction editor for an item line. */
export const CORRECT_ITEM_LABEL = "Taisyti";
/** Action that voids a PIECE item line. */
export const VOID_ITEM_LABEL = "Anuliuoti";
/** Confirm action inside the item void panel. */
export const VOID_ITEM_CONFIRM_LABEL = "Anuliuoti eilutę";

/** The active item lines of a PIECE batch, oldest first. */
export function activeBatchItems(batch: Pick<BatchDetail, "items">): BatchItem[] {
  return batch.items.filter((item) => item.status === "ACTIVE");
}

/** The total active pieces of a PIECE batch (server truth is the same sum). */
export function batchTotalPieces(batch: Pick<BatchDetail, "items">): number {
  return activeBatchItems(batch).reduce((sum, item) => sum + item.quantity, 0);
}

/** The voided item lines of a batch (kept for traceability), oldest first. */
export function voidedBatchItems(batch: Pick<BatchDetail, "items">): BatchItem[] {
  return batch.items.filter((item) => item.status === "VOIDED");
}

/** Heading for the selected batch's already-registered packages. */
export const BATCH_UNITS_HEADING = "Partijos pakuotės";

/** Empty-state text when the selected batch has no packages yet. */
export const EMPTY_BATCH_UNITS_MESSAGE =
  "Šioje partijoje dar nėra užregistruotų pakuočių.";

/** Reprint action label (reuses the existing package's label; creates nothing). */
export const REPRINT_LABEL = "Spausdinti";

/** Heading for the list of a batch's voided packages (audit trail). */
export const VOIDED_UNITS_HEADING = "Anuliuotos pakuotės";

/** Action that opens the inline correction editor for a package. */
export const CORRECT_LABEL = "Taisyti";

/** Action that voids a package (opens its reason/confirm panel). */
export const VOID_LABEL = "Anuliuoti";

/** Action that dismisses a correction/void panel without changes. */
export const CANCEL_LABEL = "Atšaukti";

/** Submit action of the correction editor. */
export const SAVE_CORRECTION_LABEL = "Išsaugoti pataisymą";

/** Label for the optional void reason input. */
export const VOID_REASON_LABEL = "Priežastis (neprivaloma)";

/** Confirm action inside the void panel. */
export const VOID_CONFIRM_LABEL = "Anuliuoti pakuotę";

/** The packages of a batch, newest registered first (id desc as a tiebreak). */
export function batchUnitsNewestFirst(
  batch: Pick<BatchDetail, "bags">,
): Bag[] {
  return [...batch.bags].sort((a, b) => {
    const byDate = Date.parse(b.createdAt) - Date.parse(a.createdAt);
    return byDate !== 0 ? byDate : b.id.localeCompare(a.id);
  });
}

/** The active (non-voided) packages of a batch, newest registered first. */
export function activeBatchUnits(batch: Pick<BatchDetail, "bags">): Bag[] {
  return batchUnitsNewestFirst(batch).filter((bag) => bag.status === "ACTIVE");
}

/** The voided packages of a batch, newest first (kept for the audit trail). */
export function voidedBatchUnits(batch: Pick<BatchDetail, "bags">): Bag[] {
  return batchUnitsNewestFirst(batch).filter((bag) => bag.status === "VOIDED");
}

/** A compact operational row for the batch's package list (net weight shown). */
export interface BatchUnitRow {
  id: string;
  barcode: string;
  locationName: string;
  netWeight: string;
  registeredAt: string;
}

export function batchUnitRow(bag: Bag): BatchUnitRow {
  return {
    id: bag.id,
    barcode: bag.barcode,
    locationName: bag.warehouseLocationName,
    netWeight: bag.netWeight,
    registeredAt: bag.createdAt,
  };
}

/**
 * Open the label surface for an **existing** package (reprint). It reuses the
 * exact package data and changes neither the delivery/batch nor the draft, so no
 * new package or barcode is created.
 */
export function openLabel(state: ReceivingState, bag: Bag): ReceivingState {
  return { ...state, label: bag };
}

/**
 * A draft for the next package of the active batch: the packaging/tare type and
 * location are suggested from the latest active package (server-derived), so
 * repeated registration of similar packages is fast; only the gross weight is
 * cleared. A batch without an active package suggests nothing.
 */
function initialUnitDraft(batch: BatchDetail): DraftBag {
  return {
    packagingTypeId: batch.suggestedPackagingTypeId ?? "",
    grossWeight: "",
    warehouseLocationId: batch.suggestedLocationId ?? "",
  };
}
