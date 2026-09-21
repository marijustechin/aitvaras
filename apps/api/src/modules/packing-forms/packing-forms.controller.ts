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
  CreatePackingFormRequestSchema,
  UpdatePackingFormRequestSchema,
  type CreatePackingFormRequest,
  type PackingForm,
  type UpdatePackingFormRequest,
} from "@aitvaras/contracts";
import { Roles } from "../../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../../common/validation/zod-validation.pipe";
import { PackingFormsService } from "./packing-forms.service";

/**
 * Packing forms (Pakavimo formos) — supporting reference/master data.
 *
 * Reading requires authentication only; creating and editing are ADMIN-only.
 */
@Controller("packing-forms")
export class PackingFormsController {
  constructor(private readonly packingFormsService: PackingFormsService) {}

  @Get()
  list(): Promise<PackingForm[]> {
    return this.packingFormsService.list();
  }

  @Get(":id")
  get(@Param("id", ParseUUIDPipe) id: string): Promise<PackingForm> {
    return this.packingFormsService.get(id);
  }

  @Post()
  @Roles("ADMIN")
  create(
    @Body(new ZodValidationPipe(CreatePackingFormRequestSchema))
    body: CreatePackingFormRequest,
  ): Promise<PackingForm> {
    return this.packingFormsService.create(body);
  }

  @Patch(":id")
  @Roles("ADMIN")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdatePackingFormRequestSchema))
    body: UpdatePackingFormRequest,
  ): Promise<PackingForm> {
    return this.packingFormsService.update(id, body);
  }
}
