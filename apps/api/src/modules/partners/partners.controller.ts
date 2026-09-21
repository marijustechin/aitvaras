import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from "@nestjs/common";
import {
  CreatePartnerRequestSchema,
  UpdatePartnerRequestSchema,
  type CreatePartnerRequest,
  type Partner,
  type UpdatePartnerRequest,
} from "@aitvaras/contracts";
import { Roles } from "../../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../../common/validation/zod-validation.pipe";
import { PartnersService } from "./partners.service";

/**
 * Business partners (Partneriai).
 *
 * Reading requires authentication only; creating and editing are ADMIN-only.
 * Server-side authorization stays authoritative regardless of UI visibility.
 */
@Controller("partners")
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  @Get()
  list(): Promise<Partner[]> {
    return this.partnersService.list();
  }

  @Get(":id")
  get(@Param("id", ParseUUIDPipe) id: string): Promise<Partner> {
    return this.partnersService.get(id);
  }

  @Post()
  @Roles("ADMIN")
  create(
    @Body(new ZodValidationPipe(CreatePartnerRequestSchema))
    body: CreatePartnerRequest,
  ): Promise<Partner> {
    return this.partnersService.create(body);
  }

  @Patch(":id")
  @Roles("ADMIN")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdatePartnerRequestSchema))
    body: UpdatePartnerRequest,
  ): Promise<Partner> {
    return this.partnersService.update(id, body);
  }
}
