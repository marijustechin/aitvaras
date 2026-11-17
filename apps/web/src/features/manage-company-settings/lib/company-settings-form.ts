import type {
  CompanySettings,
  UpdateCompanySettingsRequest,
} from "@aitvaras/contracts";

/** Editable company settings draft (all values are strings in the form). */
export interface CompanySettingsFormValues {
  name: string;
  companyCode: string;
  vatCode: string;
  country: string;
  address: string;
  email: string;
  phone: string;
}

/** Fields that can fail client-side validation. */
export type CompanySettingsField = "name" | "companyCode" | "country";

export type CompanySettingsFieldErrors = Partial<
  Record<CompanySettingsField, string>
>;

export function emptyCompanySettingsForm(): CompanySettingsFormValues {
  return {
    name: "",
    companyCode: "",
    vatCode: "",
    country: "",
    address: "",
    email: "",
    phone: "",
  };
}

/** Map the saved settings (or the empty record) into the form. */
export function companySettingsToForm(
  settings: CompanySettings,
): CompanySettingsFormValues {
  return {
    name: settings.name,
    companyCode: settings.companyCode ?? "",
    vatCode: settings.vatCode ?? "",
    country: settings.country ?? "",
    address: settings.address ?? "",
    email: settings.email ?? "",
    phone: settings.phone ?? "",
  };
}

/**
 * Client-side validation. Name, registration number and country identify the
 * company; the VAT number and contact details stay optional. The server
 * re-validates with the shared contract.
 */
export function companySettingsFieldErrors(
  values: CompanySettingsFormValues,
): CompanySettingsFieldErrors {
  const errors: CompanySettingsFieldErrors = {};
  if (values.name.trim() === "") {
    errors.name = "Įveskite įmonės pavadinimą.";
  }
  if (values.companyCode.trim() === "") {
    errors.companyCode = "Įveskite įmonės kodą.";
  }
  if (values.country.trim() === "") {
    errors.country = "Pasirinkite šalį.";
  }
  return errors;
}

/** Request body for `PUT /settings/company`. */
export function companySettingsPayload(
  values: CompanySettingsFormValues,
): UpdateCompanySettingsRequest {
  return {
    name: values.name.trim(),
    companyCode: values.companyCode.trim(),
    vatCode: values.vatCode.trim(),
    country: values.country,
    address: values.address.trim(),
    email: values.email.trim(),
    phone: values.phone.trim(),
  };
}
