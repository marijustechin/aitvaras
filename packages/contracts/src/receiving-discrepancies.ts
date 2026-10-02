import { z } from "zod";

/**
 * Lifecycle of a receiving discrepancy. A discrepancy starts `OPEN`; append-only
 * settlement entries move it to `PARTIALLY_SETTLED`, and `SETTLED` once the
 * original magnitude is fully covered. `settledAt` is set the first time it
 * becomes fully settled.
 */
export const RECEIVING_DISCREPANCY_STATUSES = [
  "OPEN",
  "PARTIALLY_SETTLED",
  "SETTLED",
] as const;
export const ReceivingDiscrepancyStatusSchema = z.enum(
  RECEIVING_DISCREPANCY_STATUSES,
);
export type ReceivingDiscrepancyStatus = z.infer<
  typeof ReceivingDiscrepancyStatusSchema
>;

/** Lithuanian labels for a discrepancy status (display only). */
export const RECEIVING_DISCREPANCY_STATUS_LABELS: Record<
  ReceivingDiscrepancyStatus,
  string
> = {
  OPEN: "Atviras",
  PARTIALLY_SETTLED: "Dalinai padengtas",
  SETTLED: "Padengtas",
};

/**
 * User-facing direction of a signed discrepancy. Derived from the immutable
 * signed `differenceWeight = measuredWeight − documentWeight`: negative is a
 * shortage (`Trūkumas`), positive an overage (`Perteklius`).
 */
export const DISCREPANCY_DIRECTIONS = ["SHORTAGE", "OVERAGE"] as const;
export const DiscrepancyDirectionSchema = z.enum(DISCREPANCY_DIRECTIONS);
export type DiscrepancyDirection = z.infer<typeof DiscrepancyDirectionSchema>;

/** Lithuanian labels for a discrepancy direction (display only). */
export const DISCREPANCY_DIRECTION_LABELS: Record<DiscrepancyDirection, string> =
  {
    SHORTAGE: "Trūkumas",
    OVERAGE: "Perteklius",
  };

/** Direction of a signed discrepancy weight string (`−` = shortage). */
export function discrepancyDirection(
  differenceWeight: string,
): DiscrepancyDirection {
  return Number(differenceWeight) < 0 ? "SHORTAGE" : "OVERAGE";
}

/** How a settlement covers (part of) the original discrepancy magnitude. */
export const DISCREPANCY_SETTLEMENT_TYPES = ["WEIGHT", "MONEY"] as const;
export const DiscrepancySettlementTypeSchema = z.enum(
  DISCREPANCY_SETTLEMENT_TYPES,
);
export type DiscrepancySettlementType = z.infer<
  typeof DiscrepancySettlementTypeSchema
>;

/** Lithuanian labels for a settlement type (display only). */
export const DISCREPANCY_SETTLEMENT_TYPE_LABELS: Record<
  DiscrepancySettlementType,
  string
> = {
  WEIGHT: "Svoriu",
  MONEY: "Pinigais",
};

/** Default currency offered by the UI for money settlements. */
export const DEFAULT_DISCREPANCY_CURRENCY = "EUR";

/**
 * A recorded receiving discrepancy: the difference between the measured physical
 * net weight and the documentary weight at confirmation time. Signed convention:
 * `differenceWeight = measuredWeight − documentWeight` (positive = physically
 * received more than documented). It is tied one-to-one to a confirmed batch, so
 * a confirmation retry cannot create duplicates. The signed difference is
 * immutable after creation.
 */
export const ReceivingDiscrepancySchema = z.object({
  id: z.uuid(),
  batchId: z.uuid(),
  supplierId: z.uuid(),
  measuredWeight: z.string(),
  documentWeight: z.string(),
  differenceWeight: z.string(),
  status: ReceivingDiscrepancyStatusSchema,
  createdById: z.uuid(),
  createdAt: z.iso.datetime(),
  settledAt: z.iso.datetime().nullable(),
});
export type ReceivingDiscrepancy = z.infer<typeof ReceivingDiscrepancySchema>;

/**
 * An append-only settlement entry. `coveredWeightKg` is always positive and in
 * kg: the amount of the original discrepancy magnitude this entry resolves. It is
 * **not** signed and is never derived from money. `WEIGHT` may link the later
 * confirmed batch that physically covers it; `MONEY` records a money/credit
 * amount (`moneyAmount` + `currency`) with no kg conversion.
 */
export const DiscrepancySettlementSchema = z.object({
  id: z.uuid(),
  discrepancyId: z.uuid(),
  type: DiscrepancySettlementTypeSchema,
  coveredWeightKg: z.string(),
  moneyAmount: z.string().nullable(),
  currency: z.string().nullable(),
  sourceBatchId: z.uuid().nullable(),
  sourceBatchCode: z.string().nullable(),
  sourceDeliveryCode: z.string().nullable(),
  reference: z.string().nullable(),
  note: z.string().nullable(),
  createdById: z.uuid(),
  createdByName: z.string(),
  createdAt: z.iso.datetime(),
});
export type DiscrepancySettlement = z.infer<
  typeof DiscrepancySettlementSchema
>;

/**
 * A discrepancy register row: the immutable discrepancy plus the derived,
 * server-calculated balance (`originalWeight = |differenceWeight|`,
 * `settledWeight = Σ settlements.coveredWeightKg`, `remainingWeight = original −
 * settled`) and joined origin context. Balances are never client-calculated.
 */
export const ReceivingDiscrepancyRegisterRowSchema = z.object({
  id: z.uuid(),
  batchId: z.uuid(),
  deliveryId: z.uuid(),
  deliveryCode: z.string(),
  batchCode: z.string(),
  supplierId: z.uuid(),
  supplierName: z.string(),
  resourceId: z.uuid(),
  resourceName: z.string(),
  warehouseName: z.string(),
  arrivalDate: z.iso.datetime(),
  measuredWeight: z.string(),
  documentWeight: z.string(),
  differenceWeight: z.string(),
  direction: DiscrepancyDirectionSchema,
  originalWeight: z.string(),
  settledWeight: z.string(),
  remainingWeight: z.string(),
  status: ReceivingDiscrepancyStatusSchema,
  createdById: z.uuid(),
  createdByName: z.string(),
  createdAt: z.iso.datetime(),
  settledAt: z.iso.datetime().nullable(),
});
export type ReceivingDiscrepancyRegisterRow = z.infer<
  typeof ReceivingDiscrepancyRegisterRowSchema
>;

/** A discrepancy with its immutable origin summary and settlement history. */
export const ReceivingDiscrepancyDetailSchema =
  ReceivingDiscrepancyRegisterRowSchema.extend({
    settlements: z.array(DiscrepancySettlementSchema),
  });
export type ReceivingDiscrepancyDetail = z.infer<
  typeof ReceivingDiscrepancyDetailSchema
>;

/**
 * Request to record a settlement. `coveredWeightKg` is the amount of the original
 * discrepancy magnitude resolved (positive, kg). `MONEY` additionally requires
 * `moneyAmount > 0` and a `currency`; `WEIGHT` must not carry money fields. An
 * optional `sourceBatchId` (WEIGHT) must be a confirmed batch of the same
 * supplier. The server validates the remaining balance transactionally.
 */
export const CreateDiscrepancySettlementRequestSchema = z
  .object({
    type: DiscrepancySettlementTypeSchema,
    coveredWeightKg: z.string().trim().min(1),
    moneyAmount: z.string().trim().min(1).optional(),
    currency: z.string().trim().min(1).max(8).optional(),
    sourceBatchId: z.uuid().optional(),
    reference: z.string().trim().max(255).optional(),
    note: z.string().trim().max(2000).optional(),
  })
  .strict();
export type CreateDiscrepancySettlementRequest = z.infer<
  typeof CreateDiscrepancySettlementRequestSchema
>;
