import { z } from "zod";
import { BatchReceivingModeSchema, BatchSchema } from "./batches";

/** Prefix of the human-facing delivery code (`GYYMM-NN`). */
export const DELIVERY_CODE_PREFIX = "G";

/** Maximum monthly delivery sequence in a delivery code (`NN`). */
export const MAX_DELIVERY_SEQUENCE = 99;

/**
 * A physical incoming delivery / arrival (Gavimas): the goods of ONE supplier on
 * ONE arrival date, registered by a warehouse worker. It is the user-facing
 * receiving unit and the container above batches: it may contain several
 * resources, and different batches may go to different warehouses. `code` is the
 * compact human-facing identifier `GYYMM-NN` and encodes no business data. Only
 * supplier + arrival date are owned here (no transport/vehicle is modelled).
 */
export const IncomingDeliverySchema = z.object({
  id: z.uuid(),
  code: z.string(),
  supplierId: z.uuid(),
  supplierName: z.string(),
  arrivalDate: z.iso.datetime(),
  createdById: z.uuid(),
  createdByName: z.string(),
  batchCount: z.number().int().nonnegative(),
  /**
   * Number of the delivery's batches still `PENDING`. Derived from the child
   * batches (never stored): a delivery needs warehouse receiving work while it
   * has at least one pending batch — or no batches yet. A delivery whose batches
   * are all `CONFIRMED` is absent from the open receiving queue.
   */
  pendingBatchCount: z.number().int().nonnegative(),
  /**
   * Whether the receipt already has a non-zero transport/customs expense record.
   * A zero-amount record does not block deletion of a batch-less receipt.
   */
  hasNonZeroExpenses: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type IncomingDelivery = z.infer<typeof IncomingDeliverySchema>;

/**
 * A delivery with its internal batches. Each batch is one resource into one
 * warehouse; supplier and arrival date are shared.
 */
export const IncomingDeliveryDetailSchema = IncomingDeliverySchema.extend({
  batches: z.array(BatchSchema),
});
export type IncomingDeliveryDetail = z.infer<typeof IncomingDeliveryDetailSchema>;

/**
 * Request to start a new delivery. The delivery code is system-generated and must
 * not be entered by the client. Supplier applies to the whole delivery; there is
 * no warehouse at delivery level.
 */
export const CreateIncomingDeliveryRequestSchema = z
  .object({
    supplierId: z.uuid(),
    arrivalDate: z.iso.datetime(),
  })
  .strict();
export type CreateIncomingDeliveryRequest = z.infer<
  typeof CreateIncomingDeliveryRequestSchema
>;

/**
 * Request to start or resolve an internal batch inside a delivery.
 *
 * `WEIGHT` (the default, backward-compatible with the existing weight flow):
 * exactly one (delivery, resource, warehouse) combination — `resourceId` is
 * required; a batch is resolved or created. `PIECE`: a batch is the
 * cost/provenance pool for several products — `resourceId` must be **absent**
 * and only `warehouseId` is used; a new piece batch is created.
 */
export const ResolveBatchRequestSchema = z
  .object({
    receivingMode: BatchReceivingModeSchema.optional(),
    resourceId: z.uuid().optional(),
    warehouseId: z.uuid(),
  })
  .strict();
export type ResolveBatchRequest = z.infer<typeof ResolveBatchRequestSchema>;

/**
 * Request to correct a PENDING batch's registration metadata.
 *
 * Receipt-level `supplierId`/`arrivalDate` apply to the whole delivery and are
 * rejected when any sibling batch is already `CONFIRMED`. Batch-level
 * `resourceId` applies only to WEIGHT batches; PIECE has per-line resources.
 * Changing the warehouse while active units exist requires
 * `relocationLocationId` (a location of the new warehouse) so existing package/
 * item identities move without being recreated.
 */
export const UpdateBatchRegistrationRequestSchema = z
  .object({
    resourceId: z.uuid().nullable().optional(),
    warehouseId: z.uuid().optional(),
    relocationLocationId: z.uuid().optional(),
    supplierId: z.uuid().optional(),
    arrivalDate: z.iso.datetime().optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.resourceId !== undefined ||
      value.warehouseId !== undefined ||
      value.relocationLocationId !== undefined ||
      value.supplierId !== undefined ||
      value.arrivalDate !== undefined,
    { message: "Nėra ką atnaujinti." },
  )
  .refine(
    (value) =>
      value.relocationLocationId === undefined ||
      value.warehouseId !== undefined,
    { message: "Perkėlimo vieta reikalauja naujo sandėlio." },
  );
export type UpdateBatchRegistrationRequest = z.infer<
  typeof UpdateBatchRegistrationRequestSchema
>;
