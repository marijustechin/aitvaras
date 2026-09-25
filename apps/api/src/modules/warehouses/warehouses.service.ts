import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@aitvaras/database";
import type {
  CreateWarehouseLocationRequest,
  CreateWarehouseRequest,
  UpdateWarehouseLocationRequest,
  UpdateWarehouseRequest,
  Warehouse,
  WarehouseLocation,
  WarehouseWithLocations,
} from "@aitvaras/contracts";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import {
  toWarehouse,
  toWarehouseLocation,
  toWarehouseWithLocations,
} from "./warehouse.mapper";

const withLocations = {
  locations: { orderBy: { name: "asc" } },
} satisfies Prisma.WarehouseInclude;

/** Warehouses and their locations (Sandėliai / Sandėlio vietos). */
@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  /** All warehouses with their locations, ordered by name. */
  async list(): Promise<WarehouseWithLocations[]> {
    const warehouses = await this.prisma.warehouse.findMany({
      include: withLocations,
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
    return warehouses.map(toWarehouseWithLocations);
  }

  async get(id: string): Promise<WarehouseWithLocations> {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
      include: withLocations,
    });
    if (!warehouse) {
      throw new NotFoundException("Warehouse not found");
    }
    return toWarehouseWithLocations(warehouse);
  }

  async create(input: CreateWarehouseRequest): Promise<WarehouseWithLocations> {
    const warehouse = await this.prisma.warehouse.create({
      data: { name: input.name },
      include: withLocations,
    });
    return toWarehouseWithLocations(warehouse);
  }

  async update(
    id: string,
    input: UpdateWarehouseRequest,
  ): Promise<WarehouseWithLocations> {
    await this.assertWarehouse(id);
    const data: Prisma.WarehouseUpdateInput = {};
    if (input.name !== undefined) {
      data.name = input.name;
    }
    if (input.active !== undefined) {
      data.active = input.active;
    }
    const warehouse = await this.prisma.warehouse.update({
      where: { id },
      data,
      include: withLocations,
    });
    return toWarehouseWithLocations(warehouse);
  }

  async listLocations(warehouseId: string): Promise<WarehouseLocation[]> {
    await this.assertWarehouse(warehouseId);
    const locations = await this.prisma.warehouseLocation.findMany({
      where: { warehouseId },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
    return locations.map(toWarehouseLocation);
  }

  async createLocation(
    warehouseId: string,
    input: CreateWarehouseLocationRequest,
  ): Promise<WarehouseLocation> {
    await this.assertWarehouse(warehouseId);
    try {
      const location = await this.prisma.warehouseLocation.create({
        data: { warehouseId, name: input.name },
      });
      return toWarehouseLocation(location);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException(
          "Vieta tokiu pavadinimu šiame sandėlyje jau yra.",
        );
      }
      throw error;
    }
  }

  async updateLocation(
    warehouseId: string,
    locationId: string,
    input: UpdateWarehouseLocationRequest,
  ): Promise<WarehouseLocation> {
    const existing = await this.prisma.warehouseLocation.findUnique({
      where: { id: locationId },
    });
    if (!existing || existing.warehouseId !== warehouseId) {
      throw new NotFoundException("Warehouse location not found");
    }

    const data: Prisma.WarehouseLocationUpdateInput = {};
    if (input.name !== undefined) {
      data.name = input.name;
    }
    if (input.active !== undefined) {
      data.active = input.active;
    }

    try {
      const location = await this.prisma.warehouseLocation.update({
        where: { id: locationId },
        data,
      });
      return toWarehouseLocation(location);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException(
          "Vieta tokiu pavadinimu šiame sandėlyje jau yra.",
        );
      }
      throw error;
    }
  }

  /** Returns the warehouse (plain) or throws 404. */
  private async assertWarehouse(id: string): Promise<Warehouse> {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!warehouse) {
      throw new NotFoundException("Warehouse not found");
    }
    return toWarehouse(warehouse);
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}
