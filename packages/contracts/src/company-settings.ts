import { z } from "zod";
import { CountryCodeSchema } from "./countries";
import { optionalTextField } from "./fields";

/** Maximum lengths for the operator company detail fields. */
export const COMPANY_SETTINGS_LIMITS = {
  name: 255,
  companyCode: 64,
  vatCode: 64,
  address: 500,
  email: 254,
  phone: 64,
} as const;

/**
 * The warehouse operator's own company details (`Nustatymai` → `Įmonė`).
 *
 * This is installation-wide shared data, deliberately separate from the
 * partner directory (suppliers/buyers). It is not per-user or browser-local.
 * Before the settings have ever been saved the API returns an empty record
 * (`updatedAt: null`) instead of inventing or overwriting business data.
 */
export const CompanySettingsSchema = z.object({
  name: z.string(),
  companyCode: z.string().nullable(),
  vatCode: z.string().nullable(),
  country: z.string().nullable(),
  address: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  updatedAt: z.iso.datetime().nullable(),
});
export type CompanySettings = z.infer<typeof CompanySettingsSchema>;

const companyName = z
  .string({ error: "Iveskite imones pavadinima." })
  .trim()
  .min(1, { message: "Iveskite imones pavadinima." })
  .max(COMPANY_SETTINGS_LIMITS.name, {
    message: "Imones pavadinimas per ilgas.",
  });

const companyRegistrationNumber = z
  .string({ error: "Iveskite imones koda." })
  .trim()
  .min(1, { message: "Iveskite imones koda." })
  .max(COMPANY_SETTINGS_LIMITS.companyCode, {
    message: "Imones kodas per ilgas.",
  });

/**
 * Update the shared company details. The record is a singleton, so the id is
 * never part of the request. The VAT number stays optional; the registration
 * number and country identify the company and are required.
 */
export const UpdateCompanySettingsRequestSchema = z
  .object({
    name: companyName,
    companyCode: companyRegistrationNumber,
    vatCode: optionalTextField(COMPANY_SETTINGS_LIMITS.vatCode),
    country: CountryCodeSchema,
    address: optionalTextField(COMPANY_SETTINGS_LIMITS.address),
    email: optionalTextField(COMPANY_SETTINGS_LIMITS.email),
    phone: optionalTextField(COMPANY_SETTINGS_LIMITS.phone),
  })
  .strict();
export type UpdateCompanySettingsRequest = z.infer<
  typeof UpdateCompanySettingsRequestSchema
>;
