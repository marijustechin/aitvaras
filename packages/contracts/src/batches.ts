import { z } from "zod";

/** Status of a receiving batch. Only `PENDING` is functional in this slice. */
export const BATCH_STATUSES = ["PENDING", "CONFIRMED", "DISCREPANCY"] as const;
export const BatchStatusSchema = z.enum(BATCH_STATUSES);
export type BatchStatus = z.infer<typeof BatchStatusSchema>;

/** Lithuanian labels for batch status (display only). */
export const BATCH_STATUS_LABELS: Record<BatchStatus, string> = {
  PENDING: "Laukiama patvirtinimo",
  CONFIRMED: "Patvirtinta",
  DISCREPANCY: "Neatitikimas",
};

/**
 * Measurement basis of a handling unit's quantity.
 *
 * - `KG` — weight-based: positive decimal, 3-decimal precision;
 * - `PCS` — count-based: positive whole units (never silently rounded).
 *
 * A batch uses a single unit: the first registered unit establishes it for the
 * whole batch.
 */
export const HANDLING_UNIT_KEYS = ["KG", "PCS"] as const;
export const HandlingUnitKeySchema = z.enum(HANDLING_UNIT_KEYS);
export type HandlingUnitKey = z.infer<typeof HandlingUnitKeySchema>;

/** Lithuanian short labels for handling units. */
export const HANDLING_UNIT_LABELS: Record<HandlingUnitKey, string> = {
  KG: "kg",
  PCS: "vnt",
};

/** Default unit for a new handling unit. */
export const DEFAULT_HANDLING_UNIT: HandlingUnitKey = "KG";

/**
 * Lifecycle of a handling unit. A unit is never hard-deleted: an erroneous unit
 * is `VOIDED` (barcode and history preserved) and excluded from the batch's
 * active measured total.
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
 * A physical bag / handling unit: one row = one physical unit inside exactly one
 * batch. `barcode` uniquely identifies the physical unit and encodes no business
 * data. `quantity` is a general measured amount with a `unit`; quantities are
 * decimal strings (never floating point). A unit is always placed in a
 * warehouse location. A `VOIDED` unit is preserved (barcode + who/when/reason)
 * but excluded from the active totals.
 */
export const BagSchema = z.object({
  id: z.uuid(),
  barcode: z.string(),
  batchId: z.uuid(),
  batchCode: z.string(),
  quantity: z.string(),
  unit: HandlingUnitKeySchema,
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
export const BAG_CORRECTION_KINDS = ["QUANTITY", "LOCATION", "VOID"] as const;
export const BagCorrectionKindSchema = z.enum(BAG_CORRECTION_KINDS);
export type BagCorrectionKind = z.infer<typeof BagCorrectionKindSchema>;

/**
 * An auditable handling-unit correction (quantity change, location change or
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
 * A receiving batch/lot (Partija). Totals (`bagCount`, `totalQuantity`) are
 * derived from the batch's bag rows, never client-supplied. `arrivalDate` is the
 * physical arrival; it is independent of `createdAt` (registration time).
 *
 * `unit` is the batch's measurement unit, derived from its first registered unit
 * (`null` until the first unit exists); all units in a batch share it.
 * `resourceCategoryName` is derived from the resource's managed category.
 *
 * Reconciliation fields are populated when the batch is formally reconciled with
 * a GoodsReceipt: `documentWeight`/`acquisitionAmount` are the accepted
 * documentary values (distinct from the measured `totalQuantity`), `difference`
 * is the derived `documentWeight − totalQuantity`, and `receiptId`/`receiptLineId`
 * point to the formal document. They are `null` while the batch is unreconciled.
 * Reconciliation remains weight-based and applies to `KG` batches only.
 */
export const BatchSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  resourceId: z.uuid(),
  resourceName: z.string(),
  resourceCategoryName: z.string(),
  supplierId: z.uuid(),
  supplierName: z.string(),
  warehouseId: z.uuid(),
  warehouseName: z.string(),
  arrivalDate: z.iso.datetime(),
  status: BatchStatusSchema,
  unit: HandlingUnitKeySchema.nullable(),
  documentWeight: z.string().nullable(),
  difference: z.string().nullable(),
  acquisitionAmount: z.string().nullable(),
  receiptId: z.uuid().nullable(),
  receiptLineId: z.uuid().nullable(),
  documentDate: z.iso.datetime().nullable(),
  documentNumber: z.string().nullable(),
  confirmedAt: z.iso.datetime().nullable(),
  createdById: z.uuid(),
  createdByName: z.string(),
  bagCount: z.number().int().nonnegative(),
  totalQuantity: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Batch = z.infer<typeof BatchSchema>;

/**
 * A batch together with its units. `suggestedLocationId` is the location of the
 * most recently registered unit in the batch (used to preselect the location for
 * the next unit); `null` when the batch has no units yet.
 */
export const BatchDetailSchema = BatchSchema.extend({
  bags: z.array(BagSchema),
  corrections: z.array(BagCorrectionSchema),
  suggestedLocationId: z.uuid().nullable(),
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
  "Svoris turi būti didesnis už nulį",
);

const positiveQuantity = decimalString.refine(
  (value) => Number(value) > 0,
  "Kiekis turi būti didesnis už nulį.",
);

/** Friendly Lithuanian message for a missing/invalid warehouse location. */
const LOCATION_REQUIRED_MESSAGE = "Pasirinkite sandėlio vietą.";

/** A required warehouse-location id (a physical unit is always placed). */
const requiredLocationId = z
  .string({ error: LOCATION_REQUIRED_MESSAGE })
  .min(1, LOCATION_REQUIRED_MESSAGE)
  .refine(
    (value) => z.uuid().safeParse(value).success,
    LOCATION_REQUIRED_MESSAGE,
  );

/** Request to start a new batch (ADMIN or warehouse worker). */
export const CreateBatchRequestSchema = z
  .object({
    resourceId: z.uuid(),
    supplierId: z.uuid(),
    warehouseId: z.uuid(),
    arrivalDate: z.iso.datetime(),
  })
  .strict();
export type CreateBatchRequest = z.infer<typeof CreateBatchRequestSchema>;

/**
 * Request to register one physical handling unit in a batch.
 *
 * `warehouseLocationId` is required (a physical unit is always placed in a
 * location belonging to the batch warehouse). `unit` defaults to `KG`; `PCS`
 * accepts positive whole units only (fractions are rejected, never silently
 * rounded), `KG` accepts positive decimals.
 */
export const CreateBagRequestSchema = z
  .object({
    unit: HandlingUnitKeySchema.default(DEFAULT_HANDLING_UNIT),
    quantity: positiveQuantity,
    warehouseLocationId: requiredLocationId,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.unit === "PCS" && !/^\d+$/.test(value.quantity)) {
      ctx.addIssue({
        code: "custom",
        path: ["quantity"],
        message: "Vienetų kiekis turi būti sveikas skaičius.",
      });
    }
  });
export type CreateBagRequest = z.infer<typeof CreateBagRequestSchema>;

/**
 * Request to correct one active handling unit (warehouse worker or ADMIN). At
 * least one field is required; the batch must not be `CONFIRMED` (and a voided
 * unit cannot be corrected). `PCS` quantities must be whole units — enforced
 * server-side against the unit.
 */
export const UpdateBagRequestSchema = z
  .object({
    quantity: positiveQuantity.optional(),
    warehouseLocationId: z.uuid().optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.quantity !== undefined || value.warehouseLocationId !== undefined,
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
 * Request to reconcile a pending (or discrepant) batch with the formal
 * GoodsReceipt. It carries only business/formal data — `documentWeight` and
 * `acquisitionAmount` (entered by Eimantas) plus optional document date/number.
 *
 * The internal `GoodsReceiptLine` anchor is **not** part of this contract: the
 * server resolves (reuses) or creates the receipt/line internally from the
 * batch context and this formal data (see BatchesService.reconcile). The measured
 * weight is never sent either — the server derives it from the batch's units.
 */
export const ReconcileBatchRequestSchema = z
  .object({
    documentWeight: positiveWeight,
    acquisitionAmount: decimalString,
    documentDate: z.iso.datetime().optional(),
    documentNumber: z
      .string()
      .trim()
      .min(1)
      .max(DOCUMENT_NUMBER_MAX_LENGTH)
      .optional(),
  })
  .strict();
export type ReconcileBatchRequest = z.infer<typeof ReconcileBatchRequestSchema>;

/**
 * Reconciliation summary returned by `POST /batches/:id/reconcile`. `measuredWeight`
 * is the server-derived SUM of bag weights (never client-supplied);
 * `difference = documentWeight − measuredWeight` and keeps the weight precision.
 */
export const BatchReconciliationSchema = z.object({
  batchId: z.uuid(),
  code: z.string(),
  status: BatchStatusSchema,
  bagCount: z.number().int().nonnegative(),
  measuredWeight: z.string(),
  documentWeight: z.string(),
  difference: z.string(),
  acquisitionAmount: z.string(),
  receiptId: z.uuid(),
  receiptLineId: z.uuid(),
  documentDate: z.iso.datetime().nullable(),
  documentNumber: z.string().nullable(),
  confirmedAt: z.iso.datetime().nullable(),
});
export type BatchReconciliation = z.infer<typeof BatchReconciliationSchema>;
