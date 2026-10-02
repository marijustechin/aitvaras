import { z } from "zod";

/** Maximum length of a packaging type name. */
export const PACKAGING_TYPE_NAME_MAX_LENGTH = 255;

/**
 * A tare weight as a decimal string with at most 3 decimals (never floating
 * point; `0` and `0.000` are valid — some packaging has no meaningful tare).
 */
const tareWeightString = z
  .string()
  .trim()
  .min(1)
  .max(20)
  .regex(/^\d+(\.\d{1,3})?$/, "Neteisingas svoris");

/**
 * A packaging / tare type (`Tara`): administrator-managed master data. Each
 * physical handling unit references one; its `tareWeightKg` is subtracted from
 * the entered gross weight to derive the net weight. Deactivated, never
 * hard-deleted so historical packages keep valid references.
 */
export const PackagingTypeSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  tareWeightKg: z.string(),
  active: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type PackagingType = z.infer<typeof PackagingTypeSchema>;

/**
 * Request to create a packaging type. `tareWeightKg` is a non-negative decimal
 * string (3-decimal precision); `active` defaults to true.
 */
export const CreatePackagingTypeRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(PACKAGING_TYPE_NAME_MAX_LENGTH),
    tareWeightKg: tareWeightString,
    active: z.boolean().optional(),
  })
  .strict();
export type CreatePackagingTypeRequest = z.infer<
  typeof CreatePackagingTypeRequestSchema
>;

/** Request to edit a packaging type (name and/or tare weight and/or active). */
export const UpdatePackagingTypeRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(PACKAGING_TYPE_NAME_MAX_LENGTH).optional(),
    tareWeightKg: tareWeightString.optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.name !== undefined ||
      value.tareWeightKg !== undefined ||
      value.active !== undefined,
    { message: "Nėra ką atnaujinti." },
  );
export type UpdatePackagingTypeRequest = z.infer<
  typeof UpdatePackagingTypeRequestSchema
>;
