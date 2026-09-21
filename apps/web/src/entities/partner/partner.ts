import { PARTNER_ROLE_LABELS, type PartnerRoleKey } from "@aitvaras/contracts";

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
