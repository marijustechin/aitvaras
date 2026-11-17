import { Injectable } from "@nestjs/common";
import type {
  CompanySettings,
  UpdateCompanySettingsRequest,
} from "@aitvaras/contracts";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import {
  EMPTY_COMPANY_SETTINGS,
  toCompanySettings,
} from "./company-settings.mapper";

/**
 * Fixed primary key of the singleton shared company-details row.
 *
 * The settings are installation-wide, so there is exactly one record. Keeping
 * the id in application code means the database schema needs no seeding and a
 * first read does not write anything.
 */
export const COMPANY_SETTINGS_ID = "00000000-0000-4000-8000-000000000001";

/** The operator's own company details (`Nustatymai` → `Įmonė`). */
@Injectable()
export class CompanySettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Saved details, or an empty record before the first save. */
  async get(): Promise<CompanySettings> {
    const record = await this.prisma.companySettings.findUnique({
      where: { id: COMPANY_SETTINGS_ID },
    });
    return record ? toCompanySettings(record) : EMPTY_COMPANY_SETTINGS;
  }

  /** Create or replace the singleton details; never touches other tables. */
  async update(
    input: UpdateCompanySettingsRequest,
  ): Promise<CompanySettings> {
    const data = {
      name: input.name,
      companyCode: input.companyCode ?? null,
      vatCode: input.vatCode ?? null,
      country: input.country,
      address: input.address ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
    };
    const record = await this.prisma.companySettings.upsert({
      where: { id: COMPANY_SETTINGS_ID },
      create: { id: COMPANY_SETTINGS_ID, ...data },
      update: data,
    });
    return toCompanySettings(record);
  }
}
