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
  CreateResourceRequestSchema,
  UpdateResourceRequestSchema,
  type CreateResourceRequest,
  type Resource,
  type UpdateResourceRequest,
} from "@aitvaras/contracts";
import { Roles } from "../../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../../common/validation/zod-validation.pipe";
import { ResourcesService } from "./resources.service";

/**
 * Resources (Ištekliai).
 *
 * Reading requires authentication only; creating and editing are ADMIN-only.
 * Server-side authorization stays authoritative regardless of UI visibility.
 */
@Controller("resources")
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Get()
  list(): Promise<Resource[]> {
    return this.resourcesService.list();
  }

  @Get(":id")
  get(@Param("id", ParseUUIDPipe) id: string): Promise<Resource> {
    return this.resourcesService.get(id);
  }

  @Post()
  @Roles("ADMIN")
  create(
    @Body(new ZodValidationPipe(CreateResourceRequestSchema))
    body: CreateResourceRequest,
  ): Promise<Resource> {
    return this.resourcesService.create(body);
  }

  @Patch(":id")
  @Roles("ADMIN")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateResourceRequestSchema))
    body: UpdateResourceRequest,
  ): Promise<Resource> {
    return this.resourcesService.update(id, body);
  }
}
