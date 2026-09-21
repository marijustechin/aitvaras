import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@aitvaras/database";
import type {
  CreateResourceRequest,
  Resource,
  UpdateResourceRequest,
} from "@aitvaras/contracts";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { toResource } from "./resource.mapper";

@Injectable()
export class ResourcesService {
  constructor(private readonly prisma: PrismaService) {}

  /** All resources, ordered deterministically by name (then id). */
  async list(): Promise<Resource[]> {
    const resources = await this.prisma.resource.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
    return resources.map(toResource);
  }

  async get(id: string): Promise<Resource> {
    const resource = await this.prisma.resource.findUnique({ where: { id } });
    if (!resource) {
      throw new NotFoundException("Resource not found");
    }
    return toResource(resource);
  }

  async create(input: CreateResourceRequest): Promise<Resource> {
    const resource = await this.prisma.resource.create({
      data: {
        name: input.name,
        category: input.category,
        notes: input.notes ?? null,
        active: input.active ?? true,
      },
    });
    return toResource(resource);
  }

  async update(id: string, input: UpdateResourceRequest): Promise<Resource> {
    const existing = await this.prisma.resource.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Resource not found");
    }

    const data: Prisma.ResourceUpdateInput = {};
    if (input.name !== undefined) {
      data.name = input.name;
    }
    if (input.category !== undefined) {
      data.category = input.category;
    }
    if (input.notes !== undefined) {
      data.notes = input.notes;
    }
    if (input.active !== undefined) {
      data.active = input.active;
    }

    const resource = await this.prisma.resource.update({ where: { id }, data });
    return toResource(resource);
  }
}
