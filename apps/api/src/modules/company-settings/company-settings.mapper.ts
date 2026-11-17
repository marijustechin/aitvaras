import type { CompanySettings } from "@aitvaras/contracts";

/** Raw `CompanySettings` row as stored by Prisma. */
export interface CompanySettingsRecord {
  name: string;
  companyCode: string | null;
  vatCode: string | null;
  country: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  updatedAt: Date;
}

/** Empty shared settings before anything has been saved. */
export const EMPTY_COMPANY_SETTINGS: CompanySettings = {
  name: "",
  companyCode: null,
  vatCode: null,
  country: null,
  address: null,
  email: null,
  phone: null,
  updatedAt: null,
};

export function toCompanySettings(record: CompanySettingsRecord): CompanySettings {
  return {
    name: record.name,
    companyCode: record.companyCode,
    vatCode: record.vatCode,
    country: record.country,
    address: record.address,
    email: record.email,
    phone: record.phone,
    updatedAt: record.updatedAt.toISOString(),
  };
}
