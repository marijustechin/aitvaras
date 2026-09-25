import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@aitvaras/database";
import type {
  CreateGoodsReceiptRequest,
  GoodsReceipt,
} from "@aitvaras/contracts";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { toGoodsReceipt } from "./receipt.mapper";

const withDetails = {
  partner: true,
  lines: {
    include: { resource: true, warehouse: true, warehouseLocation: true },
  },
} satisfies Prisma.GoodsReceiptInclude;

@Injectable()
export class ReceiptsService {
  constructor(private readonly prisma: PrismaService) {}

  /** All receipts, newest first (deterministic). */
  async list(): Promise<GoodsReceipt[]> {
    const receipts = await this.prisma.goodsReceipt.findMany({
      include: withDetails,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return receipts.map(toGoodsReceipt);
  }

  async get(id: string): Promise<GoodsReceipt> {
    const receipt = await this.prisma.goodsReceipt.findUnique({
      where: { id },
      include: withDetails,
    });
    if (!receipt) {
      throw new NotFoundException("Goods receipt not found");
    }
    return toGoodsReceipt(receipt);
  }

  /**
   * Create a receipt with its lines atomically. Partner and resource
   * eligibility is validated server-side (never trusted from UI filtering).
   * Saving does not create or modify warehouse stock.
   */
  async create(input: CreateGoodsReceiptRequest): Promise<GoodsReceipt> {
    await this.assertSupplier(input.partnerId);
    await this.assertActiveResources(input.lines.map((line) => line.resourceId));
    await this.assertActivePlacement(input.lines);

    const receipt = await this.prisma.goodsReceipt.create({
      data: {
        partnerId: input.partnerId,
        lines: {
          create: input.lines.map((line) => ({
            resourceId: line.resourceId,
            quantity: line.quantity,
            unit: line.unit,
            unitPrice: line.unitPrice,
            warehouseId: line.warehouseId,
            warehouseLocationId: line.warehouseLocationId ?? null,
          })),
        },
      },
      include: withDetails,
    });
    return toGoodsReceipt(receipt);
  }

  /** A receipt must be from an existing, active partner with the SUPPLIER role. */
  private async assertSupplier(partnerId: string): Promise<void> {
    const partner = await this.prisma.businessPartner.findUnique({
      where: { id: partnerId },
      include: { roles: true },
    });
    if (!partner) {
      throw new BadRequestException("Pasirinktas tiekėjas nerastas.");
    }
    if (!partner.active) {
      throw new BadRequestException("Pasirinktas tiekėjas neaktyvus.");
    }
    if (!partner.roles.some((assignment) => assignment.role === "SUPPLIER")) {
      throw new BadRequestException(
        "Pasirinktas partneris neturi tiekėjo vaidmens.",
      );
    }
  }

  /** Every referenced resource must exist and be active. */
  private async assertActiveResources(resourceIds: string[]): Promise<void> {
    const unique = [...new Set(resourceIds)];
    const resources = await this.prisma.resource.findMany({
      where: { id: { in: unique } },
    });
    const byId = new Map(resources.map((resource) => [resource.id, resource]));
    for (const id of unique) {
      const resource = byId.get(id);
      if (!resource) {
        throw new BadRequestException("Pasirinktas išteklius nerastas.");
      }
      if (!resource.active) {
        throw new BadRequestException("Pasirinktas išteklius neaktyvus.");
      }
    }
  }

  /**
   * Every line's warehouse must exist and be active. A location is optional: if
   * supplied it must exist, be active, and belong to the selected warehouse
   * (never trusted from the client).
   */
  private async assertActivePlacement(
    lines: CreateGoodsReceiptRequest["lines"],
  ): Promise<void> {
    const warehouseIds = [...new Set(lines.map((line) => line.warehouseId))];
    const locationIds = [
      ...new Set(
        lines
          .map((line) => line.warehouseLocationId)
          .filter((id): id is string => id !== undefined),
      ),
    ];

    const warehouses = await this.prisma.warehouse.findMany({
      where: { id: { in: warehouseIds } },
    });
    const warehousesById = new Map(
      warehouses.map((warehouse) => [warehouse.id, warehouse]),
    );
    for (const id of warehouseIds) {
      const warehouse = warehousesById.get(id);
      if (!warehouse) {
        throw new BadRequestException("Pasirinktas sandėlis nerastas.");
      }
      if (!warehouse.active) {
        throw new BadRequestException("Pasirinktas sandėlis neaktyvus.");
      }
    }

    if (locationIds.length === 0) {
      return;
    }

    const locations = await this.prisma.warehouseLocation.findMany({
      where: { id: { in: locationIds } },
    });
    const locationsById = new Map(
      locations.map((location) => [location.id, location]),
    );

    for (const line of lines) {
      if (line.warehouseLocationId === undefined) {
        continue;
      }
      const location = locationsById.get(line.warehouseLocationId);
      if (!location) {
        throw new BadRequestException("Pasirinkta sandėlio vieta nerasta.");
      }
      if (!location.active) {
        throw new BadRequestException("Pasirinkta sandėlio vieta neaktyvi.");
      }
      if (location.warehouseId !== line.warehouseId) {
        throw new BadRequestException(
          "Sandėlio vieta nepriklauso pasirinktam sandėliui.",
        );
      }
    }
  }
}
