import { z } from "zod";

/** Maximum length for a resource-category name. */
export const RESOURCE_CATEGORY_FIELD_LIMITS = {
  name: 255,
} as const;

/**
 * A resource category (Išteklių kategorija).
 *
 * Administrator-managed master data — **not** a closed enum. A resource has
 * exactly one category. Deactivated, never hard-deleted. Inactive categories
 * remain valid for existing resources but cannot be selected for new ones.
 */
export const ResourceCategorySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  active: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type ResourceCategory = z.infer<typeof ResourceCategorySchema>;

const resourceCategoryName = z
  .string()
  .trim()
  .min(1)
  .max(RESOURCE_CATEGORY_FIELD_LIMITS.name);

/** Request to create a resource category (ADMIN). */
export const CreateResourceCategoryRequestSchema = z
  .object({
    name: resourceCategoryName,
    active: z.boolean().optional(),
  })
  .strict();
export type CreateResourceCategoryRequest = z.infer<
  typeof CreateResourceCategoryRequestSchema
>;

/**
 * Request to rename/activate a resource category (ADMIN). The id comes from the
 * route; unknown fields are rejected and at least one field must be provided.
 */
export const UpdateResourceCategoryRequestSchema = z
  .object({
    name: resourceCategoryName.optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "Nothing to update",
  });
export type UpdateResourceCategoryRequest = z.infer<
  typeof UpdateResourceCategoryRequestSchema
>;
