import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@aitvaras/database";
import type {
  CreateResourceCategoryRequest,
  ResourceCategory,
  UpdateResourceCategoryRequest,
} from "@aitvaras/contracts";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { toResourceCategory } from "./resource-category.mapper";

const DUPLICATE_NAME = "Kategorija tokiu pavadinimu jau egzistuoja.";
const NOT_FOUND = "Kategorija nerasta.";

@Injectable()
export class ResourceCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** All categories, ordered deterministically by name (then id). */
  async list(): Promise<ResourceCategory[]> {
    const categories = await this.prisma.resourceCategory.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
    return categories.map(toResourceCategory);
  }

  async get(id: string): Promise<ResourceCategory> {
    const category = await this.prisma.resourceCategory.findUnique({
      where: { id },
    });
    if (!category) {
      throw new NotFoundException(NOT_FOUND);
    }
    return toResourceCategory(category);
  }

  async create(
    input: CreateResourceCategoryRequest,
  ): Promise<ResourceCategory> {
    try {
      const category = await this.prisma.resourceCategory.create({
        data: { name: input.name, active: input.active ?? true },
      });
      return toResourceCategory(category);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException(DUPLICATE_NAME);
      }
      throw error;
    }
  }

  async update(
    id: string,
    input: UpdateResourceCategoryRequest,
  ): Promise<ResourceCategory> {
    const existing = await this.prisma.resourceCategory.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(NOT_FOUND);
    }

    const data: Prisma.ResourceCategoryUpdateInput = {};
    if (input.name !== undefined) {
      data.name = input.name;
    }
    if (input.active !== undefined) {
      data.active = input.active;
    }

    try {
      const category = await this.prisma.resourceCategory.update({
        where: { id },
        data,
      });
      return toResourceCategory(category);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException(DUPLICATE_NAME);
      }
      throw error;
    }
  }
}

/** Detect a Prisma unique-constraint violation without coupling to a class. */
function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}
