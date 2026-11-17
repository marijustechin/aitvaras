import { Body, Controller, Get, Put } from "@nestjs/common";
import {
  UpdateCompanySettingsRequestSchema,
  type CompanySettings,
  type UpdateCompanySettingsRequest,
} from "@aitvaras/contracts";
import { Roles } from "../../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../../common/validation/zod-validation.pipe";
import { CompanySettingsService } from "./company-settings.service";

/**
 * Shared operator company details (`Nustatymai` → `Įmonė`).
 *
 * Reading requires authentication; saving is ADMIN-only. The resource is a
 * singleton, so there is no id in the path or body.
 */
@Controller("settings/company")
export class CompanySettingsController {
  constructor(private readonly companySettingsService: CompanySettingsService) {}

  @Get()
  get(): Promise<CompanySettings> {
    return this.companySettingsService.get();
  }

  @Put()
  @Roles("ADMIN")
  update(
    @Body(new ZodValidationPipe(UpdateCompanySettingsRequestSchema))
    body: UpdateCompanySettingsRequest,
  ): Promise<CompanySettings> {
    return this.companySettingsService.update(body);
  }
}
