import { z } from "zod";
import { ReceivingDiscrepancySchema } from "./receiving-discrepancies";

/**
 * Status of a receiving batch. A documentary/physical mismatch does **not** keep
 * a batch unconfirmed: it is confirmed and recorded as a separate
 * `ReceivingDiscrepancy`.
 */
export const BATCH_STATUSES = ["PENDING", "CONFIRMED"] as const;
export const BatchStatusSchema = z.enum(BATCH_STATUSES);
export type BatchStatus = z.infer<typeof BatchStatusSchema>;

/** Lithuanian labels for batch status (display only). */
export const BATCH_STATUS_LABELS: Record<BatchStatus, string> = {
  PENDING: "Laukiama patvirtinimo",
  CONFIRMED: "Patvirtinta",
};

/**
 * Lifecycle of a physical handling unit. A unit is never hard-deleted: an
 * erroneous unit is `VOIDED` (barcode and history preserved) and excluded from
 * the batch's active measured weight.
 */
export const BAG_STATUSES = ["ACTIVE", "VOIDED"] as const;
export const BagStatusSchema = z.enum(BAG_STATUSES);
export type BagStatus = z.infer<typeof BagStatusSchema>;

/** Lithuanian labels for a handling unit's status (display only). */
export const BAG_STATUS_LABELS: Record<BagStatus, string> = {
  ACTIVE: "Aktyvus",
  VOIDED: "Anuliuotas",
};

/**
 * A physical package / handling unit: one row = one physical package (bag, box,
 * pallet, …) inside exactly one batch. `barcode` uniquely identifies the physical
 * package and encodes no business data. Every package references one
 * `packagingType` (`Tara`); the worker enters `grossWeight` and the server derives
 * `netWeight = grossWeight − tareWeightKg` (never floating point, never
 * client-supplied). A package is always placed in a warehouse location. A
 * `VOIDED` unit is preserved but excluded from the active totals.
 */
export const BagSchema = z.object({
  id: z.uuid(),
  barcode: z.string(),
  batchId: z.uuid(),
  batchCode: z.string(),
  packagingTypeId: z.uuid(),
  packagingTypeName: z.string(),
  tareWeightKg: z.string(),
  grossWeight: z.string(),
  netWeight: z.string(),
  status: BagStatusSchema,
  warehouseLocationId: z.uuid(),
  warehouseLocationName: z.string(),
  voidedById: z.uuid().nullable(),
  voidedByName: z.string().nullable(),
  voidedAt: z.iso.datetime().nullable(),
  voidReason: z.string().nullable(),
  createdById: z.uuid(),
  createdByName: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Bag = z.infer<typeof BagSchema>;

/** Kinds of handling-unit correction recorded in the small audit trail. */
export const BAG_CORRECTION_KINDS = [
  "PACKAGING",
  "GROSS_WEIGHT",
  "LOCATION",
  "VOID",
] as const;
export const BagCorrectionKindSchema = z.enum(BAG_CORRECTION_KINDS);
export type BagCorrectionKind = z.infer<typeof BagCorrectionKindSchema>;

/**
 * An auditable handling-unit correction (weight change, location change or
 * void). Values are strings for a readable trail; `createdBy`/`createdAt` record
 * who/when.
 */
export const BagCorrectionSchema = z.object({
  id: z.uuid(),
  bagId: z.uuid(),
  bagBarcode: z.string(),
  kind: BagCorrectionKindSchema,
  previousValue: z.string().nullable(),
  newValue: z.string().nullable(),
  reason: z.string().nullable(),
  createdById: z.uuid(),
  createdByName: z.string(),
  createdAt: z.iso.datetime(),
});
export type BagCorrection = z.infer<typeof BagCorrectionSchema>;

/**
 * An internal receiving batch (Partija): the grouping of ONE resource into ONE
 * warehouse inside a single IncomingDelivery (`Gavimas`). A delivery may contain
 * several batches. `code` is an internal system-generated identifier (secondary
 * to the human-facing `deliveryCode`).
 *
 * Totals (`bagCount`, `totalNetWeight`) are derived from the batch's **active**
 * packages' net weights, never client-supplied. `supplierId`/`supplierName` and
 * `arrivalDate` are inherited from the owning delivery; `warehouseId`/
 * `warehouseName` belong to the batch. `resourceCategoryName` is derived from the
 * resource's managed category.
 *
 * Reconciliation fields are populated when the batch is formally reconciled with
 * a GoodsReceipt: `documentWeight`/`acquisitionAmount`/`documentPieces` are the
 * accepted documentary values (distinct from the measured `totalNetWeight`),
 * `difference` is the derived `documentWeight − totalNetWeight`, and
 * `receiptId`/`receiptLineId` point to the formal document. They are `null` while
 * the batch is unreconciled. `documentPieces` is optional documentary information
 * only (never a physical unit and never driving the measured weight).
 */
export const BatchSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  deliveryId: z.uuid(),
  deliveryCode: z.string(),
  resourceId: z.uuid(),
  resourceName: z.string(),
  resourceCategoryName: z.string(),
  supplierId: z.uuid(),
  supplierName: z.string(),
  warehouseId: z.uuid(),
  warehouseName: z.string(),
  arrivalDate: z.iso.datetime(),
  status: BatchStatusSchema,
  documentWeight: z.string().nullable(),
  documentPieces: z.number().int().positive().nullable(),
  // Signed `totalNetWeight − documentWeight` (positive = physically received
  // more than documented); `null` before reconciliation.
  difference: z.string().nullable(),
  // Whether this confirmed batch has a discrepancy that is not yet settled.
  hasOpenDiscrepancy: z.boolean(),
  acquisitionAmount: z.string().nullable(),
  receiptId: z.uuid().nullable(),
  receiptLineId: z.uuid().nullable(),
  documentDate: z.iso.datetime().nullable(),
  documentNumber: z.string().nullable(),
  confirmedAt: z.iso.datetime().nullable(),
  createdById: z.uuid(),
  createdByName: z.string(),
  bagCount: z.number().int().nonnegative(),
  totalNetWeight: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Batch = z.infer<typeof BatchSchema>;

/**
 * A batch together with its packages. `suggestedLocationId` and
 * `suggestedPackagingTypeId` are derived from the **latest active** package
 * (used to preselect the location and the packaging/tare type for the next
 * package); both are `null` when the batch has no active packages yet. The
 * suggestion is server-derived so it survives a refresh or re-entry, and never
 * comes from a voided package.
 */
export const BatchDetailSchema = BatchSchema.extend({
  bags: z.array(BagSchema),
  corrections: z.array(BagCorrectionSchema),
  // The batch's discrepancy records (at most one today), newest first.
  discrepancies: z.array(ReceivingDiscrepancySchema),
  suggestedLocationId: z.uuid().nullable(),
  suggestedPackagingTypeId: z.uuid().nullable(),
});
export type BatchDetail = z.infer<typeof BatchDetailSchema>;

const decimalString = z
  .string()
  .trim()
  .min(1)
  .max(20)
  .regex(/^\d+(\.\d+)?$/, "Neteisingas skaičius");

const positiveWeight = decimalString.refine(
  (value) => Number(value) > 0,
  "Svoris turi būti didesnis už nulį.",
);

/** A required positive whole number (a documentary piece count). */
const positiveInteger = z
  .number({ error: "Vienetų skaičius turi būti teigiamas sveikasis skaičius." })
  .int("Vienetų skaičius turi būti teigiamas sveikasis skaičius.")
  .positive("Vienetų skaičius turi būti teigiamas sveikasis skaičius.");

/** Friendly Lithuanian message for a missing/invalid warehouse location. */
const LOCATION_REQUIRED_MESSAGE = "Pasirinkite sandėlio vietą.";

/** A required warehouse-location id (a physical package is always placed). */
const requiredLocationId = z
  .string({ error: LOCATION_REQUIRED_MESSAGE })
  .min(1, LOCATION_REQUIRED_MESSAGE)
  .refine(
    (value) => z.uuid().safeParse(value).success,
    LOCATION_REQUIRED_MESSAGE,
  );

/**
 * Request to register one physical package in a batch.
 *
 * `packagingTypeId` and `warehouseLocationId` are required (a package always has a
 * packaging/tare type and is placed in a location belonging to the batch's
 * warehouse). The worker enters `grossWeight` (a positive decimal); the server
 * derives and stores the net weight from the packaging tare.
 */
export const CreateBagRequestSchema = z
  .object({
    packagingTypeId: z.uuid(),
    grossWeight: positiveWeight,
    warehouseLocationId: requiredLocationId,
  })
  .strict();
export type CreateBagRequest = z.infer<typeof CreateBagRequestSchema>;

/**
 * Request to correct one active handling unit (weight and/or location) while the
 * batch is not `CONFIRMED`. At least one field is required; a voided unit cannot
 * be corrected.
 */
export const UpdateBagRequestSchema = z
  .object({
    packagingTypeId: z.uuid().optional(),
    grossWeight: positiveWeight.optional(),
    warehouseLocationId: z.uuid().optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.packagingTypeId !== undefined ||
      value.grossWeight !== undefined ||
      value.warehouseLocationId !== undefined,
    { message: "Nėra ką atnaujinti." },
  );
export type UpdateBagRequest = z.infer<typeof UpdateBagRequestSchema>;

/** Maximum length for a void/correction reason. */
export const CORRECTION_REASON_MAX_LENGTH = 500;

/** Request to void an active handling unit (never hard-deletes it). */
export const VoidBagRequestSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(1)
      .max(CORRECTION_REASON_MAX_LENGTH)
      .optional(),
  })
  .strict();
export type VoidBagRequest = z.infer<typeof VoidBagRequestSchema>;

/** Maximum length for a formal document number. */
export const DOCUMENT_NUMBER_MAX_LENGTH = 64;

/**
 * Request to reconcile (confirm) a pending batch with the formal GoodsReceipt.
 * It carries only business/formal data — `documentWeight` and
 * `acquisitionAmount` (entered by Eimantas), an optional documentary
 * `documentPieces`, plus optional document date/number.
 *
 * When the measured net weight differs from `documentWeight`, confirmation is
 * still allowed but the client must explicitly set `acknowledgeDiscrepancy` to
 * `true`; the mismatch does not block confirmation and does not require editing
 * the document weight, it records a separate `ReceivingDiscrepancy`.
 *
 * The internal `GoodsReceiptLine` anchor is **not** part of this contract: the
 * server resolves (reuses) or creates the receipt/line internally. The measured
 * weight is never sent — the server derives it from the batch's packages.
 */
export const ReconcileBatchRequestSchema = z
  .object({
    documentWeight: positiveWeight,
    acquisitionAmount: decimalString,
    documentPieces: positiveInteger.optional(),
    documentDate: z.iso.datetime().optional(),
    documentNumber: z
      .string()
      .trim()
      .min(1)
      .max(DOCUMENT_NUMBER_MAX_LENGTH)
      .optional(),
    acknowledgeDiscrepancy: z.boolean().optional(),
  })
  .strict();
export type ReconcileBatchRequest = z.infer<typeof ReconcileBatchRequestSchema>;

/**
 * Reconciliation summary returned by `POST /batches/:id/reconcile`.
 * `measuredWeight` is the server-derived SUM of active package **net** weights
 * (never client-supplied); `difference = measuredWeight − documentWeight` (signed;
 * positive = physically received more than documented). `discrepancyId` is set
 * when a `ReceivingDiscrepancy` was created for this confirmation.
 */
export const BatchReconciliationSchema = z.object({
  batchId: z.uuid(),
  code: z.string(),
  status: BatchStatusSchema,
  bagCount: z.number().int().nonnegative(),
  measuredWeight: z.string(),
  documentWeight: z.string(),
  documentPieces: z.number().int().positive().nullable(),
  difference: z.string(),
  discrepancyId: z.uuid().nullable(),
  acquisitionAmount: z.string(),
  receiptId: z.uuid(),
  receiptLineId: z.uuid(),
  documentDate: z.iso.datetime().nullable(),
  documentNumber: z.string().nullable(),
  confirmedAt: z.iso.datetime().nullable(),
});
export type BatchReconciliation = z.infer<typeof BatchReconciliationSchema>;
