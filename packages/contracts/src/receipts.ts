import { z } from "zod";

/**
 * Measurement units for a goods-receipt line.
 *
 * A small, fixed set — deliberately not a user-managed administration module
 * yet. Additional units (litres, metres, m², m³, …) are added only when
 * confirmed.
 */
export const MEASUREMENT_UNIT_KEYS = ["KG", "UNIT"] as const;

export const MeasurementUnitKeySchema = z.enum(MEASUREMENT_UNIT_KEYS);

export type MeasurementUnitKey = z.infer<typeof MeasurementUnitKeySchema>;

/** Human-readable labels (Lithuanian shorthand), for display only. */
export const MEASUREMENT_UNIT_LABELS: Record<MeasurementUnitKey, string> = {
  KG: "kg",
  UNIT: "vnt.",
};

/** Default unit for a new receipt line. */
export const DEFAULT_MEASUREMENT_UNIT: MeasurementUnitKey = "KG";

/**
 * Non-negative decimal string.
 *
 * Decimals are exchanged as strings so business quantities and prices are never
 * routed through JavaScript floating point. They are persisted as PostgreSQL
 * `numeric` (Prisma `Decimal`).
 */
const DECIMAL_PATTERN = /^\d+(\.\d+)?$/;
const decimalString = z.string().trim().min(1).max(20).regex(DECIMAL_PATTERN, "Neteisingas skaičius");

const positiveDecimal = decimalString.refine(
  (value) => Number(value) > 0,
  "Kiekis turi būti didesnis už nulį",
);

/**
 * Optional warehouse-location id. An absent field or an explicit empty string
 * ("no specific location") both normalise to `undefined`; a supplied value must
 * be a UUID.
 */
const optionalLocationId = z
  .union([z.uuid(), z.literal("")])
  .transform((value) => (value === "" ? undefined : value))
  .optional();

/** A goods-receipt line as returned by the API (lineTotal is derived). */
export const GoodsReceiptLineSchema = z.object({
  id: z.uuid(),
  resourceId: z.uuid(),
  resourceName: z.string(),
  quantity: z.string(),
  unit: MeasurementUnitKeySchema,
  unitPrice: z.string(),
  warehouseId: z.uuid(),
  warehouseName: z.string(),
  warehouseLocationId: z.uuid().nullable(),
  warehouseLocationName: z.string().nullable(),
  lineTotal: z.string(),
});
export type GoodsReceiptLine = z.infer<typeof GoodsReceiptLineSchema>;

/**
 * A goods receipt (Pajamavimas) as returned by the API.
 *
 * Records the physical receipt of resources from a supplier partner only — it
 * is not an accounting purchase, invoice, payment, stock ledger or warehouse
 * balance, and it deliberately has no status/lifecycle yet.
 */
export const GoodsReceiptSchema = z.object({
  id: z.uuid(),
  partnerId: z.uuid(),
  partnerName: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  lines: z.array(GoodsReceiptLineSchema),
  total: z.string(),
});
export type GoodsReceipt = z.infer<typeof GoodsReceiptSchema>;

/** A single line in a create-receipt request. Warehouse is required; location optional. */
export const CreateGoodsReceiptLineRequestSchema = z
  .object({
    resourceId: z.uuid(),
    quantity: positiveDecimal,
    unit: MeasurementUnitKeySchema,
    unitPrice: decimalString,
    warehouseId: z.uuid(),
    warehouseLocationId: optionalLocationId,
  })
  .strict();
export type CreateGoodsReceiptLineRequest = z.infer<
  typeof CreateGoodsReceiptLineRequestSchema
>;

/** Request to create a goods receipt: one supplier partner and 1..n lines. */
export const CreateGoodsReceiptRequestSchema = z
  .object({
    partnerId: z.uuid(),
    lines: z.array(CreateGoodsReceiptLineRequestSchema).min(1),
  })
  .strict();
export type CreateGoodsReceiptRequest = z.infer<
  typeof CreateGoodsReceiptRequestSchema
>;
