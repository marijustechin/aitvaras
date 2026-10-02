import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@aitvaras/database";
import type {
  CreatePackagingTypeRequest,
  PackagingType,
  UpdatePackagingTypeRequest,
} from "@aitvaras/contracts";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { toPackagingType } from "./packaging-type.mapper";

const DUPLICATE_NAME = "Tara tokiu pavadinimu jau egzistuoja.";
const NOT_FOUND = "Tara nerasta.";

@Injectable()
export class PackagingTypesService {
  constructor(private readonly prisma: PrismaService) {}

  /** All packaging types, ordered deterministically by name (then id). */
  async list(): Promise<PackagingType[]> {
    const types = await this.prisma.packagingType.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
    return types.map(toPackagingType);
  }

  async get(id: string): Promise<PackagingType> {
    const type = await this.prisma.packagingType.findUnique({ where: { id } });
    if (!type) {
      throw new NotFoundException(NOT_FOUND);
    }
    return toPackagingType(type);
  }

  async create(input: CreatePackagingTypeRequest): Promise<PackagingType> {
    try {
      const type = await this.prisma.packagingType.create({
        data: {
          name: input.name,
          tareWeightKg: input.tareWeightKg,
          active: input.active ?? true,
        },
      });
      return toPackagingType(type);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException(DUPLICATE_NAME);
      }
      throw error;
    }
  }

  async update(
    id: string,
    input: UpdatePackagingTypeRequest,
  ): Promise<PackagingType> {
    const existing = await this.prisma.packagingType.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(NOT_FOUND);
    }

    const data: Prisma.PackagingTypeUpdateInput = {};
    if (input.name !== undefined) {
      data.name = input.name;
    }
    if (input.tareWeightKg !== undefined) {
      data.tareWeightKg = input.tareWeightKg;
    }
    if (input.active !== undefined) {
      data.active = input.active;
    }

    try {
      const type = await this.prisma.packagingType.update({
        where: { id },
        data,
      });
      return toPackagingType(type);
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
