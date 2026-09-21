import { z } from "zod";
import { optionalTextField as optionalText } from "./fields";

/**
 * Partner business roles.
 *
 * A partner is a business counterparty and may act as a supplier, a buyer, or
 * both. These are **partner roles** and are deliberately separate from system
 * access roles (`RoleKey`): they describe the business relationship, not the
 * user's permissions. Persisted as the `PartnerRole.role` value.
 */
export const PARTNER_ROLE_KEYS = ["SUPPLIER", "BUYER"] as const;

export const PartnerRoleKeySchema = z.enum(PARTNER_ROLE_KEYS);

export type PartnerRoleKey = z.infer<typeof PartnerRoleKeySchema>;

/** Human-readable labels (Lithuanian), for display only. */
export const PARTNER_ROLE_LABELS: Record<PartnerRoleKey, string> = {
  SUPPLIER: "Tiekėjas",
  BUYER: "Pirkėjas",
};

/**
 * Deterministic, de-duplicated partner-role representation.
 *
 * A partner must always hold at least one role; ordering follows
 * `PARTNER_ROLE_KEYS` so the same role set always serialises identically.
 */
export function sortPartnerRoles(
  roles: readonly PartnerRoleKey[],
): PartnerRoleKey[] {
  return [...new Set(roles)].sort(
    (left, right) =>
      PARTNER_ROLE_KEYS.indexOf(left) - PARTNER_ROLE_KEYS.indexOf(right),
  );
}

/**
 * A partner as returned by the API (list and details).
 *
 * Optional text fields are `null` when unset, never empty strings.
 */
export const PartnerSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  companyCode: z.string().nullable(),
  vatCode: z.string().nullable(),
  address: z.string().nullable(),
  country: z.string().nullable(),
  contactPerson: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  notes: z.string().nullable(),
  roles: z.array(PartnerRoleKeySchema),
  active: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Partner = z.infer<typeof PartnerSchema>;

/** Maximum lengths for the free-text partner fields. */
export const PARTNER_FIELD_LIMITS = {
  name: 255,
  companyCode: 64,
  vatCode: 64,
  address: 500,
  country: 100,
  contactPerson: 200,
  phone: 64,
  email: 254,
  notes: 2000,
} as const;

const partnerName = z.string().trim().min(1).max(PARTNER_FIELD_LIMITS.name);

const partnerRoles = z.array(PartnerRoleKeySchema).min(1);

/** Request to create a partner. At least one business role is required. */
export const CreatePartnerRequestSchema = z
  .object({
    name: partnerName,
    roles: partnerRoles,
    companyCode: optionalText(PARTNER_FIELD_LIMITS.companyCode),
    vatCode: optionalText(PARTNER_FIELD_LIMITS.vatCode),
    address: optionalText(PARTNER_FIELD_LIMITS.address),
    country: optionalText(PARTNER_FIELD_LIMITS.country),
    contactPerson: optionalText(PARTNER_FIELD_LIMITS.contactPerson),
    phone: optionalText(PARTNER_FIELD_LIMITS.phone),
    email: optionalText(PARTNER_FIELD_LIMITS.email),
    notes: optionalText(PARTNER_FIELD_LIMITS.notes),
    active: z.boolean().optional(),
  })
  .strict();
export type CreatePartnerRequest = z.infer<typeof CreatePartnerRequestSchema>;

/**
 * Request to update a partner. The partner id comes from the route, never the
 * body. Unknown keys are rejected; at least one field must be provided.
 */
export const UpdatePartnerRequestSchema = z
  .object({
    name: partnerName.optional(),
    roles: partnerRoles.optional(),
    companyCode: optionalText(PARTNER_FIELD_LIMITS.companyCode),
    vatCode: optionalText(PARTNER_FIELD_LIMITS.vatCode),
    address: optionalText(PARTNER_FIELD_LIMITS.address),
    country: optionalText(PARTNER_FIELD_LIMITS.country),
    contactPerson: optionalText(PARTNER_FIELD_LIMITS.contactPerson),
    phone: optionalText(PARTNER_FIELD_LIMITS.phone),
    email: optionalText(PARTNER_FIELD_LIMITS.email),
    notes: optionalText(PARTNER_FIELD_LIMITS.notes),
    active: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "Nothing to update",
  });
export type UpdatePartnerRequest = z.infer<typeof UpdatePartnerRequestSchema>;
