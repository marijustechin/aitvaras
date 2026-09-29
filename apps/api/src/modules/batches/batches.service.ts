import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@aitvaras/database";
import type {
  Bag,
  Batch,
  BatchDetail,
  BatchStatus,
  CreateBagRequest,
  CreateBatchRequest,
} from "@aitvaras/contracts";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { generateBagBarcode } from "./bag-barcode";
import { formatBatchCode, parseBatchSequence } from "./batch-code";
import { toBag, toBatch } from "./batch.mapper";

const MAX_CODE_ATTEMPTS = 5;
const MAX_BARCODE_ATTEMPTS = 5;

const batchInclude = {
  resource: true,
  supplier: true,
  warehouse: true,
  createdBy: true,
  _count: { select: { bags: true } },
} satisfies Prisma.BatchInclude;

const bagInclude = {
  batch: { select: { code: true } },
  warehouseLocation: true,
  createdBy: true,
} satisfies Prisma.BagInclude;

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

/**
 * Batches (Partijos) and their bags (Maišai).
 *
 * A batch records one physical delivery of one resource from one supplier into
 * one warehouse, registered bag by bag and initially `PENDING`. It is created
 * independently of the formal GoodsReceipt and may later be reconciled with one
 * without duplicating stock or quantities. Totals are always derived from bag
 * rows, never stored or client-supplied.
 */
@Injectable()
export class BatchesService {
  constructor(private readonly prisma: PrismaService) {}

  /** All batches, newest first (deterministic), optionally filtered by status. */
  async list(status?: BatchStatus): Promise<Batch[]> {
    const batches = await this.prisma.batch.findMany({
      where: status ? { status } : undefined,
      include: batchInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    if (batches.length === 0) {
      return [];
    }

    const totals = await this.prisma.bag.groupBy({
      by: ["batchId"],
      where: { batchId: { in: batches.map((batch) => batch.id) } },
      _sum: { weight: true },
    });
    const weightByBatch = new Map(
      totals.map((total) => [
        total.batchId,
        total._sum.weight ?? new Prisma.Decimal(0),
      ]),
    );

    return batches.map((batch) =>
      toBatch(batch, weightByBatch.get(batch.id) ?? new Prisma.Decimal(0)),
    );
  }

  /** One batch with its bags. */
  async get(id: string): Promise<BatchDetail> {
    const batch = await this.prisma.batch.findUnique({
      where: { id },
      include: batchInclude,
    });
    if (!batch) {
      throw new NotFoundException("Partija nerasta.");
    }

    const bags = await this.prisma.bag.findMany({
      where: { batchId: id },
      include: bagInclude,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    const totalWeight = bags.reduce(
      (sum, bag) => sum.add(bag.weight),
      new Prisma.Decimal(0),
    );

    return { ...toBatch(batch, totalWeight), bags: bags.map(toBag) };
  }

  /**
   * Start a new batch. Resource, supplier and warehouse eligibility is validated
   * server-side (never trusted from UI filtering). The batch code is generated
   * here; a database unique-conflict is retried with the next sequence.
   */
  async create(input: CreateBatchRequest, actorId: string): Promise<Batch> {
    await this.assertActiveResource(input.resourceId);
    await this.assertActiveSupplier(input.supplierId);
    await this.assertActiveWarehouse(input.warehouseId);

    const arrivalDate = new Date(input.arrivalDate);

    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
      const code = await this.nextBatchCode(new Date().getFullYear());
      try {
        const batch = await this.prisma.batch.create({
          data: {
            code,
            resourceId: input.resourceId,
            supplierId: input.supplierId,
            warehouseId: input.warehouseId,
            arrivalDate,
            createdById: actorId,
          },
          include: batchInclude,
        });
        return toBatch(batch, new Prisma.Decimal(0));
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          continue;
        }
        throw error;
      }
    }

    throw new ConflictException(
      "Nepavyko sugeneruoti unikalaus partijos kodo.",
    );
  }

  async listBags(batchId: string): Promise<Bag[]> {
    await this.assertBatchExists(batchId);
    const bags = await this.prisma.bag.findMany({
      where: { batchId },
      include: bagInclude,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return bags.map(toBag);
  }

  /**
   * Add one physical bag to a pending batch. The barcode is generated here; a
   * database unique-conflict is retried. A location, when supplied, must exist,
   * be active and belong to the batch's warehouse.
   */
  async createBag(
    batchId: string,
    input: CreateBagRequest,
    actorId: string,
  ): Promise<Bag> {
    const batch = await this.prisma.batch.findUnique({ where: { id: batchId } });
    if (!batch) {
      throw new NotFoundException("Partija nerasta.");
    }
    if (batch.status !== "PENDING") {
      throw new BadRequestException(
        "Maišus galima pridėti tik į laukiančią partiją.",
      );
    }
    if (input.warehouseLocationId) {
      await this.assertLocationInWarehouse(
        input.warehouseLocationId,
        batch.warehouseId,
      );
    }

    for (let attempt = 0; attempt < MAX_BARCODE_ATTEMPTS; attempt += 1) {
      const barcode = generateBagBarcode();
      try {
        const bag = await this.prisma.bag.create({
          data: {
            barcode,
            batchId,
            weight: input.weight,
            warehouseLocationId: input.warehouseLocationId ?? null,
            createdById: actorId,
          },
          include: bagInclude,
        });
        return toBag(bag);
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          continue;
        }
        throw error;
      }
    }

    throw new ConflictException(
      "Nepavyko sugeneruoti unikalaus brūkšninio kodo.",
    );
  }

  /** Look up one bag by its unique barcode. */
  async getBagByBarcode(barcode: string): Promise<Bag> {
    const bag = await this.prisma.bag.findUnique({
      where: { barcode },
      include: bagInclude,
    });
    if (!bag) {
      throw new NotFoundException(
        "Maišas su tokiu brūkšniniu kodu nerastas.",
      );
    }
    return toBag(bag);
  }

  private async nextBatchCode(year: number): Promise<string> {
    const last = await this.prisma.batch.findFirst({
      where: { code: { startsWith: `P-${year}-` } },
      orderBy: { code: "desc" },
      select: { code: true },
    });
    const sequence = last ? (parseBatchSequence(last.code, year) ?? 0) : 0;
    return formatBatchCode(year, sequence + 1);
  }

  private async assertBatchExists(batchId: string): Promise<void> {
    const batch = await this.prisma.batch.findUnique({
      where: { id: batchId },
      select: { id: true },
    });
    if (!batch) {
      throw new NotFoundException("Partija nerasta.");
    }
  }

  private async assertActiveResource(resourceId: string): Promise<void> {
    const resource = await this.prisma.resource.findUnique({
      where: { id: resourceId },
    });
    if (!resource) {
      throw new BadRequestException("Pasirinktas išteklius nerastas.");
    }
    if (!resource.active) {
      throw new BadRequestException("Pasirinktas išteklius neaktyvus.");
    }
  }

  private async assertActiveSupplier(supplierId: string): Promise<void> {
    const supplier = await this.prisma.businessPartner.findUnique({
      where: { id: supplierId },
      include: { roles: true },
    });
    if (!supplier) {
      throw new BadRequestException("Pasirinktas tiekėjas nerastas.");
    }
    if (!supplier.active) {
      throw new BadRequestException("Pasirinktas tiekėjas neaktyvus.");
    }
    if (!supplier.roles.some((assignment) => assignment.role === "SUPPLIER")) {
      throw new BadRequestException(
        "Pasirinktas partneris neturi tiekėjo vaidmens.",
      );
    }
  }

  private async assertActiveWarehouse(warehouseId: string): Promise<void> {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: warehouseId },
    });
    if (!warehouse) {
      throw new BadRequestException("Pasirinktas sandėlis nerastas.");
    }
    if (!warehouse.active) {
      throw new BadRequestException("Pasirinktas sandėlis neaktyvus.");
    }
  }

  private async assertLocationInWarehouse(
    locationId: string,
    warehouseId: string,
  ): Promise<void> {
    const location = await this.prisma.warehouseLocation.findUnique({
      where: { id: locationId },
    });
    if (!location) {
      throw new BadRequestException("Pasirinkta sandėlio vieta nerasta.");
    }
    if (!location.active) {
      throw new BadRequestException("Pasirinkta sandėlio vieta neaktyvi.");
    }
    if (location.warehouseId !== warehouseId) {
      throw new BadRequestException(
        "Sandėlio vieta nepriklauso pasirinktam sandėliui.",
      );
    }
  }
}
