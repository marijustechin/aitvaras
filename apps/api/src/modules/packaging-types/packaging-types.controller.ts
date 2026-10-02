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
  CreatePackagingTypeRequestSchema,
  UpdatePackagingTypeRequestSchema,
  type CreatePackagingTypeRequest,
  type PackagingType,
  type UpdatePackagingTypeRequest,
} from "@aitvaras/contracts";
import { Roles } from "../../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../../common/validation/zod-validation.pipe";
import { PackagingTypesService } from "./packaging-types.service";

/**
 * Packaging / tare types (`Tara`) — administrator-managed master data.
 *
 * Reading requires authentication only; creating and editing are ADMIN-only.
 * No delete endpoint: packaging types are deactivated, never hard-deleted, so
 * historical packages keep valid references.
 */
@Controller("packaging-types")
export class PackagingTypesController {
  constructor(private readonly packagingTypesService: PackagingTypesService) {}

  @Get()
  list(): Promise<PackagingType[]> {
    return this.packagingTypesService.list();
  }

  @Get(":id")
  get(@Param("id", ParseUUIDPipe) id: string): Promise<PackagingType> {
    return this.packagingTypesService.get(id);
  }

  @Post()
  @Roles("ADMIN")
  create(
    @Body(new ZodValidationPipe(CreatePackagingTypeRequestSchema))
    body: CreatePackagingTypeRequest,
  ): Promise<PackagingType> {
    return this.packagingTypesService.create(body);
  }

  @Patch(":id")
  @Roles("ADMIN")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdatePackagingTypeRequestSchema))
    body: UpdatePackagingTypeRequest,
  ): Promise<PackagingType> {
    return this.packagingTypesService.update(id, body);
  }
}
