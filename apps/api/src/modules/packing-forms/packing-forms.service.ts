import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@aitvaras/database";
import type {
  CreatePackingFormRequest,
  PackingForm,
  UpdatePackingFormRequest,
} from "@aitvaras/contracts";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { toPackingForm } from "./packing-form.mapper";

@Injectable()
export class PackingFormsService {
  constructor(private readonly prisma: PrismaService) {}

  /** All packing forms, ordered deterministically by name (then id). */
  async list(): Promise<PackingForm[]> {
    const forms = await this.prisma.packingForm.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
    return forms.map(toPackingForm);
  }

  async get(id: string): Promise<PackingForm> {
    const form = await this.prisma.packingForm.findUnique({ where: { id } });
    if (!form) {
      throw new NotFoundException("Packing form not found");
    }
    return toPackingForm(form);
  }

  async create(input: CreatePackingFormRequest): Promise<PackingForm> {
    try {
      const form = await this.prisma.packingForm.create({
        data: { name: input.name, active: input.active ?? true },
      });
      return toPackingForm(form);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("Packing form name already exists");
      }
      throw error;
    }
  }

  async update(
    id: string,
    input: UpdatePackingFormRequest,
  ): Promise<PackingForm> {
    const existing = await this.prisma.packingForm.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Packing form not found");
    }

    const data: Prisma.PackingFormUpdateInput = {};
    if (input.name !== undefined) {
      data.name = input.name;
    }
    if (input.active !== undefined) {
      data.active = input.active;
    }

    try {
      const form = await this.prisma.packingForm.update({ where: { id }, data });
      return toPackingForm(form);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("Packing form name already exists");
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
