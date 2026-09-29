import { z } from "zod";
import { optionalTextField } from "./fields";

/** Maximum lengths for resource fields. */
export const RESOURCE_FIELD_LIMITS = {
  name: 255,
  notes: 2000,
} as const;

/**
 * A resource as returned by the API.
 *
 * A resource has exactly one **managed** category (see `resource-categories.ts`).
 * The category is returned denormalised (`categoryId`, `categoryName`,
 * `categoryActive`) so the UI can display an inactive category that is still
 * assigned without losing it.
 *
 * Only confirmed fields exist. Purchase/sales price, VAT, barcode, quantity,
 * stock, location, supplier, packing form, dimensions, weight, unit and reorder
 * level are deliberately absent until confirmed. `notes` is `null` when unset.
 */
export const ResourceSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  categoryId: z.uuid(),
  categoryName: z.string(),
  categoryActive: z.boolean(),
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

/** Request to create a resource. A category id is required. */
export const CreateResourceRequestSchema = z
  .object({
    name: resourceName,
    categoryId: z.uuid(),
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
    categoryId: z.uuid().optional(),
    notes: optionalTextField(RESOURCE_FIELD_LIMITS.notes),
    active: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "Nothing to update",
  });
export type UpdateResourceRequest = z.infer<typeof UpdateResourceRequestSchema>;
