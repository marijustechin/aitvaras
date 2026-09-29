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
  CreateResourceCategoryRequestSchema,
  UpdateResourceCategoryRequestSchema,
  type CreateResourceCategoryRequest,
  type ResourceCategory,
  type UpdateResourceCategoryRequest,
} from "@aitvaras/contracts";
import { Roles } from "../../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../../common/validation/zod-validation.pipe";
import { ResourceCategoriesService } from "./resource-categories.service";

/**
 * Resource categories (Išteklių kategorijos) — administrator-managed master data.
 *
 * Reading requires authentication only; creating and editing are ADMIN-only.
 * No delete endpoint: categories are deactivated, never hard-deleted.
 */
@Controller("resource-categories")
export class ResourceCategoriesController {
  constructor(
    private readonly resourceCategoriesService: ResourceCategoriesService,
  ) {}

  @Get()
  list(): Promise<ResourceCategory[]> {
    return this.resourceCategoriesService.list();
  }

  @Get(":id")
  get(@Param("id", ParseUUIDPipe) id: string): Promise<ResourceCategory> {
    return this.resourceCategoriesService.get(id);
  }

  @Post()
  @Roles("ADMIN")
  create(
    @Body(new ZodValidationPipe(CreateResourceCategoryRequestSchema))
    body: CreateResourceCategoryRequest,
  ): Promise<ResourceCategory> {
    return this.resourceCategoriesService.create(body);
  }

  @Patch(":id")
  @Roles("ADMIN")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateResourceCategoryRequestSchema))
    body: UpdateResourceCategoryRequest,
  ): Promise<ResourceCategory> {
    return this.resourceCategoriesService.update(id, body);
  }
}
