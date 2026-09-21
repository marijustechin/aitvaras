import type { Partner, PartnerRoleKey } from "@aitvaras/contracts";

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
    country: partner.country ?? "",
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
    companyCode: values.companyCode.trim(),
    vatCode: values.vatCode.trim(),
    country: values.country.trim(),
    address: values.address.trim(),
    contactPerson: values.contactPerson.trim(),
    phone: values.phone.trim(),
    email: values.email.trim(),
    notes: values.notes.trim(),
    active: values.active,
  };
}

/** Client-side validation message keyed to a form problem, or null. */
export function partnerFormError(values: PartnerFormValues): string | null {
  if (values.name.trim() === "") {
    return "Įveskite partnerio pavadinimą.";
  }
  if (values.roles.length === 0) {
    return "Pasirinkite bent vieną vaidmenį.";
  }
  return null;
}
