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
 * A physical bag / handling unit: one row = one physical unit inside exactly one
 * batch. `barcode` uniquely identifies the physical unit and encodes no business
 * data. Weights are decimal strings (never floating point).
 */
export const BagSchema = z.object({
  id: z.uuid(),
  barcode: z.string(),
  batchId: z.uuid(),
  batchCode: z.string(),
  weight: z.string(),
  warehouseLocationId: z.uuid().nullable(),
  warehouseLocationName: z.string().nullable(),
  createdById: z.uuid(),
  createdByName: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Bag = z.infer<typeof BagSchema>;

/**
 * A receiving batch/lot (Partija). Totals (`bagCount`, `totalWeight`) are derived
 * from the batch's bag rows, never client-supplied. `arrivalDate` is the physical
 * arrival; it is independent of `createdAt` (registration time).
 */
export const BatchSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  resourceId: z.uuid(),
  resourceName: z.string(),
  supplierId: z.uuid(),
  supplierName: z.string(),
  warehouseId: z.uuid(),
  warehouseName: z.string(),
  arrivalDate: z.iso.datetime(),
  status: BatchStatusSchema,
  createdById: z.uuid(),
  createdByName: z.string(),
  bagCount: z.number().int().nonnegative(),
  totalWeight: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Batch = z.infer<typeof BatchSchema>;

/** A batch together with its bags. */
export const BatchDetailSchema = BatchSchema.extend({
  bags: z.array(BagSchema),
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

/**
 * Optional warehouse-location id: an absent field or an explicit empty string
 * ("no specific location") both normalise to `undefined`.
 */
const optionalLocationId = z
  .union([z.uuid(), z.literal("")])
  .transform((value) => (value === "" ? undefined : value))
  .optional();

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

/** Request to add one physical bag to a batch. */
export const CreateBagRequestSchema = z
  .object({
    weight: positiveWeight,
    warehouseLocationId: optionalLocationId,
  })
  .strict();
export type CreateBagRequest = z.infer<typeof CreateBagRequestSchema>;
