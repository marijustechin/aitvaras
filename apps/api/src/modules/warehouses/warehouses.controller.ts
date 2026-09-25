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
  CreateWarehouseLocationRequestSchema,
  CreateWarehouseRequestSchema,
  UpdateWarehouseLocationRequestSchema,
  UpdateWarehouseRequestSchema,
  type CreateWarehouseLocationRequest,
  type CreateWarehouseRequest,
  type UpdateWarehouseLocationRequest,
  type UpdateWarehouseRequest,
  type WarehouseLocation,
  type WarehouseWithLocations,
} from "@aitvaras/contracts";
import { Roles } from "../../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../../common/validation/zod-validation.pipe";
import { WarehousesService } from "./warehouses.service";

/**
 * Warehouses (Sandėliai) and their locations (Sandėlio vietos).
 *
 * Reading requires authentication only; creating/editing are ADMIN-only.
 * Locations are owned by their warehouse, so they live in this module and are
 * addressed through nested routes. No DELETE.
 */
@Controller("warehouses")
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Get()
  list(): Promise<WarehouseWithLocations[]> {
    return this.warehousesService.list();
  }

  @Get(":id")
  get(@Param("id", ParseUUIDPipe) id: string): Promise<WarehouseWithLocations> {
    return this.warehousesService.get(id);
  }

  @Post()
  @Roles("ADMIN")
  create(
    @Body(new ZodValidationPipe(CreateWarehouseRequestSchema))
    body: CreateWarehouseRequest,
  ): Promise<WarehouseWithLocations> {
    return this.warehousesService.create(body);
  }

  @Patch(":id")
  @Roles("ADMIN")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateWarehouseRequestSchema))
    body: UpdateWarehouseRequest,
  ): Promise<WarehouseWithLocations> {
    return this.warehousesService.update(id, body);
  }

  @Get(":id/locations")
  listLocations(
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<WarehouseLocation[]> {
    return this.warehousesService.listLocations(id);
  }

  @Post(":id/locations")
  @Roles("ADMIN")
  createLocation(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CreateWarehouseLocationRequestSchema))
    body: CreateWarehouseLocationRequest,
  ): Promise<WarehouseLocation> {
    return this.warehousesService.createLocation(id, body);
  }

  @Patch(":warehouseId/locations/:locationId")
  @Roles("ADMIN")
  updateLocation(
    @Param("warehouseId", ParseUUIDPipe) warehouseId: string,
    @Param("locationId", ParseUUIDPipe) locationId: string,
    @Body(new ZodValidationPipe(UpdateWarehouseLocationRequestSchema))
    body: UpdateWarehouseLocationRequest,
  ): Promise<WarehouseLocation> {
    return this.warehousesService.updateLocation(warehouseId, locationId, body);
  }
}
