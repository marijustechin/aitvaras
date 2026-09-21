import { z } from "zod";
import { optionalTextField } from "./fields";

/**
 * Resource categories.
 *
 * A resource has **exactly one** category. This is a small, fixed domain
 * classification (a business/schema decision), deliberately represented as a
 * stable enum rather than a user-managed CRUD table. Adding a new category is a
 * domain/schema change, not ordinary end-user configuration.
 */
export const RESOURCE_CATEGORY_KEYS = [
  "RAW_MATERIAL",
  "SEMI_FINISHED",
  "FINISHED_PRODUCT",
] as const;

export const ResourceCategoryKeySchema = z.enum(RESOURCE_CATEGORY_KEYS);

export type ResourceCategoryKey = z.infer<typeof ResourceCategoryKeySchema>;

/** Human-readable labels (Lithuanian), for display only. */
export const RESOURCE_CATEGORY_LABELS: Record<ResourceCategoryKey, string> = {
  RAW_MATERIAL: "Žaliava",
  SEMI_FINISHED: "Pusgaminis",
  FINISHED_PRODUCT: "Gaminys",
};

/** Maximum lengths for resource fields. */
export const RESOURCE_FIELD_LIMITS = {
  name: 255,
  notes: 2000,
} as const;

/**
 * A resource as returned by the API.
 *
 * Only confirmed fields exist. Purchase/sales price, VAT, barcode, quantity,
 * stock, location, supplier, packing form, dimensions, weight, unit and reorder
 * level are deliberately absent until confirmed. `notes` is `null` when unset.
 */
export const ResourceSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  category: ResourceCategoryKeySchema,
  notes: z.string().nullable(),
  active: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Resource = z.infer<typeof ResourceSchema>;

const resourceName = z
  .string()
  .trim()
  .min(1)
  .max(RESOURCE_FIELD_LIMITS.name);

/** Request to create a resource. A category is required. */
export const CreateResourceRequestSchema = z
  .object({
    name: resourceName,
    category: ResourceCategoryKeySchema,
    notes: optionalTextField(RESOURCE_FIELD_LIMITS.notes),
    active: z.boolean().optional(),
  })
  .strict();
export type CreateResourceRequest = z.infer<typeof CreateResourceRequestSchema>;

/**
 * Request to update a resource. The id comes from the route, never the body;
 * unknown fields are rejected and at least one field must be provided.
 */
export const UpdateResourceRequestSchema = z
  .object({
    name: resourceName.optional(),
    category: ResourceCategoryKeySchema.optional(),
    notes: optionalTextField(RESOURCE_FIELD_LIMITS.notes),
    active: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "Nothing to update",
  });
export type UpdateResourceRequest = z.infer<typeof UpdateResourceRequestSchema>;
