import { sortPartnerRoles, type Partner, type PartnerRoleKey } from "@aitvaras/contracts";

/** Row shape returned when a partner is loaded with its role assignments. */
export interface PartnerRecord {
  id: string;
  name: string;
  companyCode: string | null;
  vatCode: string | null;
  address: string | null;
  country: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  roles: { role: string }[];
}

/** Map a database partner to the shared public representation. */
export function toPartner(record: PartnerRecord): Partner {
  return {
    id: record.id,
    name: record.name,
    companyCode: record.companyCode,
    vatCode: record.vatCode,
    address: record.address,
    country: record.country,
    contactPerson: record.contactPerson,
    phone: record.phone,
    email: record.email,
    notes: record.notes,
    roles: sortPartnerRoles(
      record.roles.map((assignment) => assignment.role as PartnerRoleKey),
    ),
    active: record.active,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
