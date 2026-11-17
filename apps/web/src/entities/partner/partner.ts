import {
  countryName,
  PARTNER_ROLE_LABELS,
  type Partner,
  type PartnerRoleKey,
} from "@aitvaras/contracts";

/** Empty-state text for the partners list. */
export const EMPTY_PARTNERS_MESSAGE = "Partnerių dar nėra.";

/** Lithuanian UI label for a partner business role (never the raw key). */
export function partnerRoleLabel(role: PartnerRoleKey): string {
  return PARTNER_ROLE_LABELS[role];
}

/** Comma-separated Lithuanian labels for a partner's business roles. */
export function partnerRoleSummary(roles: readonly PartnerRoleKey[]): string {
  return roles.map(partnerRoleLabel).join(", ");
}

/**
 * Lithuanian display name for a stored ISO alpha-2 country code.
 *
 * Falls back to the raw stored value only for legacy/unrecognized data; it never
 * invents a country.
 */
export function partnerCountryName(country: string | null): string | null {
  if (!country) {
    return null;
  }
  return countryName(country) ?? country;
}

/**
 * A partner is selectable as a supplier for a goods receipt when it is active
 * and holds the SUPPLIER business role (Supplier-only or Supplier+Buyer).
 */
export function isActiveSupplier(partner: Partner): boolean {
  return partner.active && partner.roles.includes("SUPPLIER");
}

/** Active supplier partners, for receipt selection (server still validates). */
export function activeSuppliers(partners: readonly Partner[]): Partner[] {
  return partners.filter(isActiveSupplier);
}
