import {
  canonicalCountryCode,
  isCountryCode,
  type Partner,
  type PartnerRoleKey,
} from "@aitvaras/contracts";

/** Editable partner form values (all free-text inputs are strings). */
export interface PartnerFormValues {
  name: string;
  roles: PartnerRoleKey[];
  companyCode: string;
  vatCode: string;
  country: string;
  address: string;
  contactPerson: string;
  phone: string;
  email: string;
  notes: string;
  active: boolean;
}

/** Identification fields that can carry a field-level error. */
export type PartnerFieldKey = "name" | "roles" | "country" | "companyCode";

export type PartnerFieldErrors = Partial<Record<PartnerFieldKey, string>>;

/** Blank form values for a new partner (defaults to active, no roles). */
export function emptyPartnerFormValues(): PartnerFormValues {
  return {
    name: "",
    roles: [],
    companyCode: "",
    vatCode: "",
    country: "",
    address: "",
    contactPerson: "",
    phone: "",
    email: "",
    notes: "",
    active: true,
  };
}

/** Map an API partner to editable form values (null becomes an empty string). */
export function partnerToFormValues(partner: Partner): PartnerFormValues {
  return {
    name: partner.name,
    roles: partner.roles,
    companyCode: partner.companyCode ?? "",
    vatCode: partner.vatCode ?? "",
    country: canonicalCountryCode(partner.country) ?? "",
    address: partner.address ?? "",
    contactPerson: partner.contactPerson ?? "",
    phone: partner.phone ?? "",
    email: partner.email ?? "",
    notes: partner.notes ?? "",
    active: partner.active,
  };
}

/** Convert form values into the create/update request payload. */
export function partnerFormToPayload(values: PartnerFormValues): {
  name: string;
  roles: PartnerRoleKey[];
  companyCode: string;
  vatCode: string;
  country: string;
  address: string;
  contactPerson: string;
  phone: string;
  email: string;
  notes: string;
  active: boolean;
} {
  return {
    name: values.name.trim(),
    roles: values.roles,
    // A string, never a number: leading zeros remain significant.
    companyCode: values.companyCode.trim(),
    vatCode: values.vatCode.trim(),
    country: values.country.trim().toUpperCase(),
    address: values.address.trim(),
    contactPerson: values.contactPerson.trim(),
    phone: values.phone.trim(),
    email: values.email.trim(),
    notes: values.notes.trim(),
    active: values.active,
  };
}

/**
 * Field-level client validation for the partner form.
 *
 * Company identification (name, country, registration number) is required for
 * every partner because the current model has no individual/natural-person
 * distinction. Country must be selected from the ISO list.
 */
export function partnerFormFieldErrors(
  values: PartnerFormValues,
): PartnerFieldErrors {
  const errors: PartnerFieldErrors = {};

  if (values.name.trim() === "") {
    errors.name = "Įveskite partnerio pavadinimą.";
  }
  if (values.roles.length === 0) {
    errors.roles = "Pasirinkite bent vieną vaidmenį.";
  }
  const country = values.country.trim().toUpperCase();
  if (country === "") {
    errors.country = "Pasirinkite šalį.";
  } else if (!isCountryCode(country)) {
    errors.country = "Pasirinkite šalį iš sąrašo.";
  }
  if (values.companyCode.trim() === "") {
    errors.companyCode = "Įveskite įmonės kodą.";
  }

  return errors;
}