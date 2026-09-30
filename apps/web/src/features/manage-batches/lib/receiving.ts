import type {
  Bag,
  Batch,
  BatchDetail,
  HandlingUnitKey,
} from "@aitvaras/contracts";
import {
  createDraftBag,
  initialBagDraft,
  type DraftBag,
} from "./batch-form";

/**
 * Modes of the simplified warehouse receiving flow.
 *
 * - `choose` — pick "Nauja partija" or an existing open batch;
 * - `new` — enter the minimum a worker knows to start a new `PENDING` batch;
 * - `bag` — register handling units into the (newly created or selected) batch.
 */
export type ReceivingMode = "choose" | "new" | "bag";

export const RECEIVING_MODES: readonly ReceivingMode[] = [
  "choose",
  "new",
  "bag",
];

/** Label for the "start a new batch" action. */
export const NEW_BATCH_LABEL = "Nauja partija";

/** Save-only action: create the unit and return to the form (no label/print). */
export const SAVE_LABEL = "Išsaugoti";

/** Save-and-print action: create the unit, open the label and print it. */
export const SAVE_AND_PRINT_LABEL = "Išsaugoti ir spausdinti";

/** Empty-state text when no open batches are available to add units to. */
export const EMPTY_OPEN_BATCHES_MESSAGE = "Nėra atvirų partijų.";

/**
 * The only inputs the warehouse worker enters per handling unit, in form order.
 * Documentary/financial fields (see `FORMAL_RECONCILIATION_FIELDS`) are never
 * part of this form.
 */
export const BAG_RECEIVING_FIELDS = [
  "warehouseLocationId",
  "unit",
  "quantity",
] as const;
export type BagReceivingField = (typeof BAG_RECEIVING_FIELDS)[number];

/**
 * Fields that belong **only** to the formal ADMIN reconciliation flow and must
 * never be shown in the warehouse receiving flow.
 */
export const FORMAL_RECONCILIATION_FIELDS = [
  "documentWeight",
  "acquisitionAmount",
  "documentNumber",
  "documentDate",
  "receiptLineId",
  "confirmedAt",
] as const;
export type FormalReconciliationField =
  (typeof FORMAL_RECONCILIATION_FIELDS)[number];

/** The batch context shown to the worker (no formal/documentary values). */
export const WORKER_BATCH_CONTEXT_FIELDS = [
  "code",
  "supplierName",
  "resourceName",
  "warehouseName",
  "arrivalDate",
  "bagCount",
  "totalQuantity",
  "unit",
] as const;
export type WorkerBatchContextField =
  (typeof WORKER_BATCH_CONTEXT_FIELDS)[number];

/**
 * Batches the worker may still work on: `PENDING` (add units) and `DISCREPANCY`
 * (correct the physical units that caused the mismatch). A `CONFIRMED` batch is
 * frozen and never listed here.
 */
export function openReceivingBatches(batches: readonly Batch[]): Batch[] {
  return batches.filter(
    (batch) => batch.status === "PENDING" || batch.status === "DISCREPANCY",
  );
}

/** Heading for the batches flagged with a discrepancy (`Reikia patikslinti`). */
export const CORRECTION_BATCHES_HEADING = "Reikia patikslinti";

/** Hint shown above the discrepancy batches that need physical correction. */
export const CORRECTION_BATCHES_HINT =
  "Šios partijos turi neatitikimą — patikslinkite maišus.";

/** Empty-state text when there are no pending batches (only discrepancies). */
export const EMPTY_PENDING_BATCHES_MESSAGE = "Nėra laukiančių partijų.";

/** Action that opens the inline correction editor for a unit. */
export const CORRECT_LABEL = "Taisyti";

/** Action that voids a unit (opens its reason/confirm panel). */
export const VOID_LABEL = "Anuliuoti";

/** Action that dismisses a correction/void panel without changes. */
export const CANCEL_LABEL = "Atšaukti";

/** Submit action of the correction editor. */
export const SAVE_CORRECTION_LABEL = "Išsaugoti pataisymą";

/** Label for the optional void reason input. */
export const VOID_REASON_LABEL = "Priežastis (neprivaloma)";

/** Confirm action inside the void panel. */
export const VOID_CONFIRM_LABEL = "Anuliuoti maišą";

/** Heading for the list of a batch's voided units (audit trail). */
export const VOIDED_UNITS_HEADING = "Anuliuoti maišai";

/** The active (non-voided) units of a batch, newest registered first. */
export function activeBatchUnits(batch: Pick<BatchDetail, "bags">): Bag[] {
  return batchUnitsNewestFirst(batch).filter((bag) => bag.status === "ACTIVE");
}

/** The voided units of a batch, newest first (kept for the audit trail). */
export function voidedBatchUnits(batch: Pick<BatchDetail, "bags">): Bag[] {
  return batchUnitsNewestFirst(batch).filter((bag) => bag.status === "VOIDED");
}

export interface BatchReceivingContext {
  batchId: string;
  code: string;
  supplierId: string;
  supplierName: string;
  resourceId: string;
  resourceName: string;
  resourceCategoryName: string;
  warehouseId: string;
  warehouseName: string;
  arrivalDate: string;
  bagCount: number;
  totalQuantity: string;
  /** Established unit, or null until the first unit is registered. */
  unit: HandlingUnitKey | null;
}

/**
 * Map a batch to the context the worker inherits in bag mode. Supplier,
 * resource and warehouse are fixed by the batch and are never re-entered or
 * allowed to drift; the unit is fixed once the first unit establishes it.
 */
export function batchReceivingContext(batch: Batch): BatchReceivingContext {
  return {
    batchId: batch.id,
    code: batch.code,
    supplierId: batch.supplierId,
    supplierName: batch.supplierName,
    resourceId: batch.resourceId,
    resourceName: batch.resourceName,
    resourceCategoryName: batch.resourceCategoryName,
    warehouseId: batch.warehouseId,
    warehouseName: batch.warehouseName,
    arrivalDate: batch.arrivalDate,
    bagCount: batch.bagCount,
    totalQuantity: batch.totalQuantity,
    unit: batch.unit,
  };
}

/**
 * The data printed on a handling-unit label. The barcode is the only machine
 * value (opaque physical-unit identifier); everything else is human-readable
 * metadata and is never encoded into the barcode.
 */
export interface BagLabelData {
  barcode: string;
  batchCode: string;
  quantity: string;
  unit: HandlingUnitKey;
  resourceName: string;
  categoryName: string;
  warehouseName: string;
  locationName: string;
}

export function bagLabelData(
  batch: Pick<
    Batch,
    "code" | "resourceName" | "resourceCategoryName" | "warehouseName"
  >,
  bag: Pick<
    Bag,
    "barcode" | "quantity" | "unit" | "warehouseLocationName"
  >,
): BagLabelData {
  return {
    barcode: bag.barcode,
    batchCode: batch.code,
    quantity: bag.quantity,
    unit: bag.unit,
    resourceName: batch.resourceName,
    categoryName: batch.resourceCategoryName,
    warehouseName: batch.warehouseName,
    locationName: bag.warehouseLocationName,
  };
}

/**
 * The surface shown while receiving a batch: the entry `form`, or the `label`
 * of the unit that was just saved. There is deliberately **no** intermediate
 * `detail` surface — a successful save goes straight to the label, and closing
 * it returns to the form.
 */
export const BAG_SURFACES = ["form", "label"] as const;
export type BagSurface = (typeof BAG_SURFACES)[number];

export interface BagModeState {
  batch: BatchDetail | null;
  draft: DraftBag;
  /** The unit whose label is open; `null` means the entry form is shown. */
  label: Bag | null;
}

export function initialBagModeState(): BagModeState {
  return { batch: null, draft: createDraftBag(), label: null };
}

/**
 * Select or create a batch: show its entry form with the batch's suggested draft
 * (its established unit and last-used location).
 */
export function enterBagMode(batch: BatchDetail): BagModeState {
  return { batch, draft: initialBagDraft(batch), label: null };
}

/**
 * A successful save: open the saved unit's label and prepare the next draft.
 * The batch is preserved, the unit is kept, the last-used location stays
 * suggested and only the quantity is reset.
 */
export function applyUnitSaved(
  batch: BatchDetail,
  bag: Bag,
): BagModeState {
  return { batch, draft: initialBagDraft(batch), label: bag };
}

/**
 * A successful **save-only**: refresh the batch and return to the entry form
 * with the next draft (same unit/last location, quantity reset) and **no** label
 * surface.
 */
export function applyUnitSavedSilently(batch: BatchDetail): BagModeState {
  return { batch, draft: initialBagDraft(batch), label: null };
}

/** A failed save: keep the draft untouched and never open a label. */
export function applyUnitSaveFailed(current: BagModeState): BagModeState {
  return { ...current, label: null };
}

/** Close the label and return to the entry form (batch + next draft preserved). */
export function closeLabel(current: BagModeState): BagModeState {
  return { ...current, label: null };
}

/** The surface currently shown in bag mode. */
export function bagSurface(state: BagModeState): BagSurface {
  return state.label ? "label" : "form";
}

/** Heading for the open (unconfirmed) batch list on the receiving page. */
export const UNCONFIRMED_BATCHES_HEADING = "Nepatvirtintos partijos";

/** Heading for the selected batch's already-registered units. */
export const BATCH_UNITS_HEADING = "Partijos maišai";

/** Empty-state text when the selected batch has no units yet. */
export const EMPTY_BATCH_UNITS_MESSAGE =
  "Šioje partijoje dar nėra užregistruotų maišų.";

/** Reprint action label (reuses the existing unit's label; creates nothing). */
export const REPRINT_LABEL = "Spausdinti";

/** The units of a batch, newest registered first (id desc as a tiebreak). */
export function batchUnitsNewestFirst(
  batch: Pick<BatchDetail, "bags">,
): Bag[] {
  return [...batch.bags].sort((a, b) => {
    const byDate = Date.parse(b.createdAt) - Date.parse(a.createdAt);
    return byDate !== 0 ? byDate : b.id.localeCompare(a.id);
  });
}

/** A compact operational row for the batch's unit list. */
export interface BatchUnitRow {
  id: string;
  barcode: string;
  locationName: string;
  quantity: string;
  unit: HandlingUnitKey;
  registeredAt: string;
}

export function batchUnitRow(bag: Bag): BatchUnitRow {
  return {
    id: bag.id,
    barcode: bag.barcode,
    locationName: bag.warehouseLocationName,
    quantity: bag.quantity,
    unit: bag.unit,
    registeredAt: bag.createdAt,
  };
}

/**
 * Open the label surface for an **existing** unit (reprint). It reuses the exact
 * unit data and changes neither the batch nor the draft, so no new unit or
 * barcode is created.
 */
export function openLabel(current: BagModeState, bag: Bag): BagModeState {
  return { ...current, label: bag };
}
