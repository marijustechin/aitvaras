import { z } from "zod";

/** Maximum length for a warehouse / location name. */
export const WAREHOUSE_FIELD_LIMITS = { name: 255 } as const;

const warehouseName = z
  .string()
  .trim()
  .min(1)
  .max(WAREHOUSE_FIELD_LIMITS.name);

/** A warehouse (Sandėlis). Deactivated, never deleted. */
export const WarehouseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  active: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Warehouse = z.infer<typeof WarehouseSchema>;

/**
 * A physical location (Sandėlio vieta) that belongs to exactly one warehouse.
 * Location names are unique per warehouse, not globally.
 */
export const WarehouseLocationSchema = z.object({
  id: z.uuid(),
  warehouseId: z.uuid(),
  name: z.string(),
  active: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type WarehouseLocation = z.infer<typeof WarehouseLocationSchema>;

/** A warehouse together with its locations. */
export const WarehouseWithLocationsSchema = WarehouseSchema.extend({
  locations: z.array(WarehouseLocationSchema),
});
export type WarehouseWithLocations = z.infer<
  typeof WarehouseWithLocationsSchema
>;

/** Request to create a warehouse (ADMIN). */
export const CreateWarehouseRequestSchema = z
  .object({ name: warehouseName })
  .strict();
export type CreateWarehouseRequest = z.infer<
  typeof CreateWarehouseRequestSchema
>;

/** Request to rename/activate a warehouse (ADMIN); at least one field. */
export const UpdateWarehouseRequestSchema = z
  .object({
    name: warehouseName.optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "Nothing to update",
  });
export type UpdateWarehouseRequest = z.infer<
  typeof UpdateWarehouseRequestSchema
>;

/** Request to create a location inside a warehouse (ADMIN). */
export const CreateWarehouseLocationRequestSchema = z
  .object({ name: warehouseName })
  .strict();
export type CreateWarehouseLocationRequest = z.infer<
  typeof CreateWarehouseLocationRequestSchema
>;

/** Request to rename/activate a location (ADMIN); at least one field. */
export const UpdateWarehouseLocationRequestSchema = z
  .object({
    name: warehouseName.optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "Nothing to update",
  });
export type UpdateWarehouseLocationRequest = z.infer<
  typeof UpdateWarehouseLocationRequestSchema
>;
