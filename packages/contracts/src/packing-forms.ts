import { z } from "zod";

/** Maximum length for a packing-form name. */
export const PACKING_FORM_FIELD_LIMITS = {
  name: 255,
} as const;

/**
 * A packing form (Pakavimo forma): how goods are physically packed or presented
 * for handling/storage.
 *
 * Packing forms are **independent reference/master data**. They are deliberately
 * **not** a permanent property of a resource — a later receipt may use a
 * different form for the same resource. The receipt/transaction link is not
 * implemented yet.
 */
export const PackingFormSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  active: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type PackingForm = z.infer<typeof PackingFormSchema>;

const packingFormName = z
  .string()
  .trim()
  .min(1)
  .max(PACKING_FORM_FIELD_LIMITS.name);

/** Request to create a packing form. */
export const CreatePackingFormRequestSchema = z
  .object({
    name: packingFormName,
    active: z.boolean().optional(),
  })
  .strict();
export type CreatePackingFormRequest = z.infer<
  typeof CreatePackingFormRequestSchema
>;

/**
 * Request to update a packing form. The id comes from the route; unknown fields
 * are rejected and at least one field must be provided.
 */
export const UpdatePackingFormRequestSchema = z
  .object({
    name: packingFormName.optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "Nothing to update",
  });
export type UpdatePackingFormRequest = z.infer<
  typeof UpdatePackingFormRequestSchema
>;
