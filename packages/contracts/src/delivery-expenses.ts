import { z } from "zod";

/**
 * Receipt-level expense allocation methods.
 *
 * `BY_VALUE` allocates proportionally by actual net kg for an all-WEIGHT receipt
 * or by actual pieces for an all-PIECE receipt. It is deliberately unavailable
 * for mixed kg/vnt. receipts. `EQUAL` splits equally across eligible batches and
 * is the only valid method for a mixed receipt.
 */
export const DELIVERY_EXPENSE_ALLOCATION_METHODS = ["BY_VALUE", "EQUAL"] as const;

export const DeliveryExpenseAllocationMethodSchema = z.enum(
  DELIVERY_EXPENSE_ALLOCATION_METHODS,
);
export type DeliveryExpenseAllocationMethod = z.infer<
  typeof DeliveryExpenseAllocationMethodSchema
>;

export const DELIVERY_EXPENSE_ALLOCATION_METHOD_LABELS: Record<
  DeliveryExpenseAllocationMethod,
  string
> = {
  BY_VALUE: "Pagal vertę",
  EQUAL: "Po lygiai",
};

const moneyInput = z
  .string()
  .trim()
  .min(1, { message: "Iveskite suma." })
  .max(20)
  .transform((value) => value.replace(",", "."))
  .refine(
    (value) => /^\d+(\.\d{1,2})?$/.test(value),
    { message: "Iveskite teisinga suma (pvz., 125,50)." },
  );

/**
 * Saved receipt expenses. A delivery without a saved record returns zero amounts
 * and the default method instead of writing defaults into the database.
 */
export const DeliveryExpensesSchema = z.object({
  deliveryId: z.uuid(),
  transportAmount: z.string(),
  customsAmount: z.string(),
  allocationMethod: DeliveryExpenseAllocationMethodSchema,
  updatedAt: z.iso.datetime().nullable(),
});
export type DeliveryExpenses = z.infer<typeof DeliveryExpensesSchema>;

/** Create/replace the one shared expense record for a receipt. */
export const UpdateDeliveryExpensesRequestSchema = z
  .object({
    transportAmount: moneyInput,
    customsAmount: moneyInput,
    allocationMethod: DeliveryExpenseAllocationMethodSchema,
  })
  .strict();
export type UpdateDeliveryExpensesRequest = z.infer<
  typeof UpdateDeliveryExpensesRequestSchema
>;

/** One batch's current and proposed expense shares for a receipt preview. */
export const DeliveryExpenseBatchAllocationSchema = z.object({
  batchId: z.uuid(),
  code: z.string(),
  resourceName: z.string().nullable(),
  receivingMode: z.enum(["WEIGHT", "PIECE"]),
  unit: z.enum(["KG", "PCS"]),
  actualQuantity: z.string(),
  /** Recorded acquisition value, or null when it is unknown. */
  acquisitionAmount: z.string().nullable(),
  status: z.enum(["PENDING", "CONFIRMED"]),
  currentTransportAmount: z.string(),
  currentCustomsAmount: z.string(),
  proposedTransportAmount: z.string(),
  proposedCustomsAmount: z.string(),
});
export type DeliveryExpenseBatchAllocation = z.infer<
  typeof DeliveryExpenseBatchAllocationSchema
>;

/**
 * Proposed receipt allocation. Shows each batch's current and proposed share,
 * the allocated totals and any balance that remains unallocated.
 */
export const DeliveryExpensePreviewSchema = z.object({
  deliveryId: z.uuid(),
  transportAmount: z.string(),
  customsAmount: z.string(),
  allocationMethod: DeliveryExpenseAllocationMethodSchema,
  basis: z.enum(["NET_WEIGHT", "PIECES", "ACQUISITION"]),
  proportionalAvailable: z.boolean(),
  proportionalBlockedReason: z.string().nullable(),
  batches: z.array(DeliveryExpenseBatchAllocationSchema),
  allocatedTransportTotal: z.string(),
  allocatedCustomsTotal: z.string(),
  unallocatedTransport: z.string(),
  unallocatedCustoms: z.string(),
  lastAppliedAt: z.iso.datetime().nullable(),
  lastAppliedByName: z.string().nullable(),
});
export type DeliveryExpensePreview = z.infer<
  typeof DeliveryExpensePreviewSchema
>;

/** Result of applying the proposed allocation to the whole receipt. */
export const ApplyDeliveryExpensesResponseSchema =
  DeliveryExpensePreviewSchema.extend({
    applied: z.boolean(),
    applicationId: z.uuid().nullable(),
  });
export type ApplyDeliveryExpensesResponse = z.infer<
  typeof ApplyDeliveryExpensesResponseSchema
>;
