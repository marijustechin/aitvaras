import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@aitvaras/database";
import type {
  CreateResourceRequest,
  Resource,
  UpdateResourceRequest,
} from "@aitvaras/contracts";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { toResource } from "./resource.mapper";

const CATEGORY_NOT_FOUND = "Pasirinkta kategorija nerasta.";
const CATEGORY_INACTIVE = "Pasirinkta kategorija neaktyvi.";
const RESOURCE_NOT_FOUND = "Išteklius nerastas.";

/** The category relation is always loaded so the API can denormalise it. */
const withCategory = {
  category: true,
} satisfies Prisma.ResourceInclude;

@Injectable()
export class ResourcesService {
  constructor(private readonly prisma: PrismaService) {}

  /** All resources, ordered deterministically by name (then id). */
  async list(): Promise<Resource[]> {
    const resources = await this.prisma.resource.findMany({
      include: withCategory,
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
    return resources.map(toResource);
  }

  async get(id: string): Promise<Resource> {
    const resource = await this.prisma.resource.findUnique({
      where: { id },
      include: withCategory,
    });
    if (!resource) {
      throw new NotFoundException(RESOURCE_NOT_FOUND);
    }
    return toResource(resource);
  }

  async create(input: CreateResourceRequest): Promise<Resource> {
    await this.assertCategoryAssignable(input.categoryId);
    const resource = await this.prisma.resource.create({
      data: {
        name: input.name,
        categoryId: input.categoryId,
        notes: input.notes ?? null,
        active: input.active ?? true,
      },
      include: withCategory,
    });
    return toResource(resource);
  }

  async update(id: string, input: UpdateResourceRequest): Promise<Resource> {
    const existing = await this.prisma.resource.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(RESOURCE_NOT_FOUND);
    }

    const data: Prisma.ResourceUpdateInput = {};
    if (input.name !== undefined) {
      data.name = input.name;
    }
    if (input.notes !== undefined) {
      data.notes = input.notes;
    }
    if (input.active !== undefined) {
      data.active = input.active;
    }
    if (input.categoryId !== undefined) {
      // An inactive category may not be newly selected, but a resource that
      // already uses it keeps it (the "update" is then a no-op for category).
      if (input.categoryId !== existing.categoryId) {
        await this.assertCategoryAssignable(input.categoryId);
      }
      data.category = { connect: { id: input.categoryId } };
    }

    const resource = await this.prisma.resource.update({
      where: { id },
      data,
      include: withCategory,
    });
    return toResource(resource);
  }

  /** A category must exist and be active to be assigned to a resource. */
  private async assertCategoryAssignable(categoryId: string): Promise<void> {
    const category = await this.prisma.resourceCategory.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      throw new BadRequestException(CATEGORY_NOT_FOUND);
    }
    if (!category.active) {
      throw new BadRequestException(CATEGORY_INACTIVE);
    }
  }
}
