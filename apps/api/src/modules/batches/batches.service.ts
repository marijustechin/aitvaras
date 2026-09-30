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
  BatchReconciliation,
  BatchStatus,
  CreateBagRequest,
  CreateBatchRequest,
  HandlingUnitKey,
  ReconcileBatchRequest,
  UpdateBagRequest,
  VoidBagRequest,
} from "@aitvaras/contracts";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { generateBagBarcode } from "./bag-barcode";
import { formatBatchCode, parseBatchSequence } from "./batch-code";
import { toBag, toBagCorrection, toBatch } from "./batch.mapper";

const MAX_CODE_ATTEMPTS = 5;
const MAX_BARCODE_ATTEMPTS = 5;

const batchInclude = {
  resource: { include: { category: true } },
  supplier: true,
  warehouse: true,
  createdBy: true,
  receiptLine: {
    select: {
      id: true,
      goodsReceiptId: true,
      receipt: { select: { documentDate: true, documentNumber: true } },
    },
  },
} satisfies Prisma.BatchInclude;

const bagInclude = {
  batch: { select: { code: true } },
  warehouseLocation: true,
  createdBy: true,
  voidedBy: true,
} satisfies Prisma.BagInclude;

/** Bag include for a correction: also needs the batch's status/warehouse. */
const correctableBagInclude = {
  batch: { select: { code: true, warehouseId: true, status: true } },
  warehouseLocation: true,
  createdBy: true,
  voidedBy: true,
} satisfies Prisma.BagInclude;

const bagCorrectionInclude = {
  createdBy: true,
  bag: { select: { barcode: true } },
} satisfies Prisma.BagCorrectionInclude;

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

  /**
   * All batches, newest first (deterministic), optionally filtered by status.
   * Totals are derived from the units; because a batch uses a single unit at a
   * time, grouping by `(batchId, unit)` yields one row per batch.
   */
  async list(status?: BatchStatus): Promise<Batch[]> {
    const batches = await this.prisma.batch.findMany({
      where: status ? { status } : undefined,
      include: batchInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    if (batches.length === 0) {
      return [];
    }

    const groups = await this.prisma.bag.groupBy({
      by: ["batchId", "unit"],
      where: {
        batchId: { in: batches.map((batch) => batch.id) },
        status: "ACTIVE",
      },
      _sum: { quantity: true },
      _count: { _all: true },
    });
    const summaryByBatch = new Map(
      groups.map((group) => [
        group.batchId,
        {
          unit: group.unit as HandlingUnitKey,
          totalQuantity: group._sum.quantity ?? new Prisma.Decimal(0),
          bagCount: group._count._all,
        },
      ]),
    );

    return batches.map((batch) =>
      toBatch(
        batch,
        summaryByBatch.get(batch.id) ?? {
          unit: null,
          totalQuantity: new Prisma.Decimal(0),
          bagCount: 0,
        },
      ),
    );
  }

  /** One batch with its units. */
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
    // Voided units are preserved for the audit trail but never counted in the
    // measured total or the active unit count.
    const activeBags = bags.filter((bag) => bag.status === "ACTIVE");
    const totalQuantity = activeBags.reduce(
      (sum, bag) => sum.add(bag.quantity),
      new Prisma.Decimal(0),
    );
    const firstUnit = bags[0]?.unit;
    const lastActiveBag = activeBags[activeBags.length - 1];

    const corrections = await this.prisma.bagCorrection.findMany({
      where: { bag: { batchId: id } },
      include: bagCorrectionInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });

    return {
      ...toBatch(batch, {
        totalQuantity,
        bagCount: activeBags.length,
        unit: firstUnit ? (firstUnit as HandlingUnitKey) : null,
      }),
      bags: bags.map(toBag),
      corrections: corrections.map(toBagCorrection),
      suggestedLocationId: lastActiveBag
        ? lastActiveBag.warehouseLocationId
        : null,
    };
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
        return toBatch(batch, {
          totalQuantity: new Prisma.Decimal(0),
          bagCount: 0,
          unit: null,
        });
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
   * Add one physical bag to a not-yet-confirmed batch. Adding is allowed while
   * the batch is `PENDING` or `DISCREPANCY` (a worker registering a forgotten
   * unit is a physical correction); a `CONFIRMED` batch is frozen. The barcode is
   * generated here; a database unique-conflict is retried. A location, when
   * supplied, must exist, be active and belong to the batch's warehouse.
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
    if (batch.status === "CONFIRMED") {
      throw new BadRequestException({
        code: "BATCH_CONFIRMED",
        message: "Į patvirtintą partiją maišų pridėti negalima.",
      });
    }
    await this.assertLocationInWarehouse(
      input.warehouseLocationId,
      batch.warehouseId,
    );

    // A batch uses a single measurement unit: the first unit establishes it and
    // every later unit must match (no mixed KG/PCS totals).
    const established = await this.prisma.bag.findFirst({
      where: { batchId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { unit: true },
    });
    if (established && established.unit !== input.unit) {
      throw new BadRequestException({
        code: "UNIT_MISMATCH",
        message: "Partijoje jau naudojamas kitas matavimo vienetas.",
      });
    }
    const unit: HandlingUnitKey = established
      ? (established.unit as HandlingUnitKey)
      : input.unit;

    for (let attempt = 0; attempt < MAX_BARCODE_ATTEMPTS; attempt += 1) {
      const barcode = generateBagBarcode();
      try {
        const bag = await this.prisma.bag.create({
          data: {
            barcode,
            batchId,
            quantity: input.quantity,
            unit,
            warehouseLocationId: input.warehouseLocationId,
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

  /**
   * Correct one active handling unit (quantity and/or location) while the batch
   * is not yet `CONFIRMED`. Physical reality is authoritative: a worker fixes
   * what they physically measure/place. Each effective change is recorded as an
   * auditable `BagCorrection`; a no-op returns the unit unchanged with no trail.
   * The batch status is not changed here — a `DISCREPANCY` batch stays
   * discrepant until the ADMIN re-reconciles it.
   */
  async correctBag(
    batchId: string,
    bagId: string,
    input: UpdateBagRequest,
    actorId: string,
  ): Promise<Bag> {
    const bag = await this.loadCorrectableBag(batchId, bagId);
    const unit = bag.unit as HandlingUnitKey;
    const data: Prisma.BagUpdateInput = {};
    const corrections: Prisma.BagCorrectionCreateManyInput[] = [];

    if (input.quantity !== undefined) {
      if (unit === "PCS" && !/^\d+$/.test(input.quantity)) {
        throw new BadRequestException({
          code: "UNIT_MISMATCH",
          message: "Vienetų kiekis turi būti sveikas skaičius.",
        });
      }
      const next = new Prisma.Decimal(input.quantity);
      if (!next.equals(bag.quantity)) {
        data.quantity = next;
        corrections.push({
          bagId: bag.id,
          kind: "QUANTITY",
          previousValue: bag.quantity.toString(),
          newValue: next.toString(),
          createdById: actorId,
        });
      }
    }

    const targetLocationId = input.warehouseLocationId;
    if (
      targetLocationId !== undefined &&
      targetLocationId !== bag.warehouseLocationId
    ) {
      const location = await this.assertLocationInWarehouse(
        targetLocationId,
        bag.batch.warehouseId,
      );
      data.warehouseLocation = { connect: { id: targetLocationId } };
      corrections.push({
        bagId: bag.id,
        kind: "LOCATION",
        previousValue: bag.warehouseLocation.name,
        newValue: location.name,
        createdById: actorId,
      });
    }

    if (corrections.length === 0) {
      return toBag(bag);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.bagCorrection.createMany({ data: corrections });
      return tx.bag.update({
        where: { id: bag.id },
        data,
        include: bagInclude,
      });
    });
    return toBag(updated);
  }

  /**
   * Void (annul) one active handling unit while the batch is not yet
   * `CONFIRMED`. The unit is never deleted: its barcode and history are kept and
   * it is excluded from the measured total. Who/when/why is recorded.
   */
  async voidBag(
    batchId: string,
    bagId: string,
    input: VoidBagRequest,
    actorId: string,
  ): Promise<Bag> {
    const bag = await this.loadCorrectableBag(batchId, bagId);
    const reason = input.reason ?? null;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.bagCorrection.create({
        data: {
          bagId: bag.id,
          kind: "VOID",
          previousValue: `${bag.quantity.toString()} ${bag.unit}`,
          newValue: null,
          reason,
          createdById: actorId,
        },
      });
      return tx.bag.update({
        where: { id: bag.id },
        data: {
          status: "VOIDED",
          voidedById: actorId,
          voidedAt: new Date(),
          voidReason: reason,
        },
        include: bagInclude,
      });
    });
    return toBag(updated);
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

  /**
   * Reconcile a batch with the formal GoodsReceipt (Eimantas' documentary
   * confirmation). Resolves or creates the internal receipt-line anchor from the
   * batch context and the formal data (`resolveReceiptLine`), records the
   * accepted documentary weight/acquisition value, and derives the status.
   *
   * The measured weight is always derived from the batch's bags here — it is
   * never sent by the client. The physical quantity lives in the bags; the
   * receipt is the formal document, so reconciliation creates **no** new bags and
   * no stock. It links to (or creates) exactly one receipt line, reusing it on a
   * discrepancy retry.
   *
   * `CONFIRMED` is a terminal state (re-confirmation is rejected); a
   * `DISCREPANCY` batch may be reconciled again once the documentary value is
   * corrected, which is how a discrepancy is resolved without an irreversible
   * trap.
   */
  async reconcile(
    batchId: string,
    input: ReconcileBatchRequest,
  ): Promise<BatchReconciliation> {
    const batch = await this.prisma.batch.findUnique({ where: { id: batchId } });
    if (!batch) {
      throw new NotFoundException({
        code: "BATCH_NOT_FOUND",
        message: "Partija nerasta.",
      });
    }
    if (batch.status === "CONFIRMED") {
      throw new ConflictException({
        code: "BATCH_ALREADY_CONFIRMED",
        message: "Partija jau patvirtinta ir negali būti patvirtinta pakartotinai.",
      });
    }

    const bags = await this.prisma.bag.findMany({
      where: { batchId, status: "ACTIVE" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { unit: true, quantity: true },
    });
    if (bags.length === 0) {
      throw new BadRequestException({
        code: "BATCH_EMPTY",
        message: "Partijoje dar nėra nė vieno maišo.",
      });
    }
    // Weight reconciliation applies to KG batches only; PCS quantities are never
    // summed into kilograms and no mixed-unit total is produced.
    if (bags[0]?.unit !== "KG") {
      throw new BadRequestException({
        code: "BATCH_NOT_WEIGHT",
        message:
          "Pajamavimo patvirtinimas šiuo metu galimas tik kg partijoms.",
      });
    }
    const bagCount = bags.length;
    const measuredWeight = bags.reduce(
      (sum, bag) => sum.add(bag.quantity),
      new Prisma.Decimal(0),
    );

    const documentWeight = new Prisma.Decimal(input.documentWeight);
    const acquisitionAmount = new Prisma.Decimal(input.acquisitionAmount);
    const difference = documentWeight.sub(measuredWeight);
    const status: BatchStatus = difference.isZero() ? "CONFIRMED" : "DISCREPANCY";
    const confirmedAt = status === "CONFIRMED" ? new Date() : null;
    const requestedDocumentDate = input.documentDate
      ? new Date(input.documentDate)
      : null;
    const requestedDocumentNumber = input.documentNumber ?? null;

    // Resolve or create the internal formal-document anchor from the batch
    // context and formal data — the client never selects a receipt line.
    const anchor = await this.resolveReceiptLine(batch, {
      documentWeight,
      acquisitionAmount,
      documentDate: requestedDocumentDate,
      documentNumber: requestedDocumentNumber,
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      // Populate the formal document metadata only when it is missing; an
      // already-recorded document date/number is never overwritten.
      if (
        (requestedDocumentDate && !anchor.receipt.documentDate) ||
        (requestedDocumentNumber && !anchor.receipt.documentNumber)
      ) {
        await tx.goodsReceipt.update({
          where: { id: anchor.receiptId },
          data: {
            documentDate: anchor.receipt.documentDate ?? requestedDocumentDate,
            documentNumber:
              anchor.receipt.documentNumber ?? requestedDocumentNumber,
          },
        });
      }
      return tx.batch.update({
        where: { id: batchId },
        data: {
          receiptLineId: anchor.receiptLineId,
          documentWeight,
          acquisitionAmount,
          status,
          confirmedAt,
        },
        include: batchInclude,
      });
    });

    return {
      batchId: updated.id,
      code: updated.code,
      status,
      bagCount,
      measuredWeight: measuredWeight.toString(),
      documentWeight: documentWeight.toString(),
      difference: difference.toString(),
      acquisitionAmount: acquisitionAmount.toString(),
      receiptId: anchor.receiptId,
      receiptLineId: anchor.receiptLineId,
      documentDate:
        updated.receiptLine?.receipt.documentDate?.toISOString() ?? null,
      documentNumber: updated.receiptLine?.receipt.documentNumber ?? null,
      confirmedAt: confirmedAt ? confirmedAt.toISOString() : null,
    };
  }

  /**
   * Resolve the internal formal-document anchor (`GoodsReceipt -> line -> batch`)
   * without exposing a technical selector to the user. Deterministic order:
   *
   *  1. retry — reuse the line the batch is already linked to (no duplicates);
   *  2. reuse an existing compatible, **unlinked** receipt line (same supplier
   *     via the receipt partner, resource and warehouse);
   *  3. otherwise create a `GoodsReceipt` with one line from the formal values
   *     (KG, quantity = documentary weight, unit price = value ÷ weight).
   *
   * A reused line is never mutated; the accepted documentary values live on the
   * batch (`documentWeight`/`acquisitionAmount`).
   */
  private async resolveReceiptLine(
    batch: {
      resourceId: string;
      supplierId: string;
      warehouseId: string;
      receiptLineId: string | null;
    },
    formal: {
      documentWeight: Prisma.Decimal;
      acquisitionAmount: Prisma.Decimal;
      documentDate: Date | null;
      documentNumber: string | null;
    },
  ): Promise<{
    receiptId: string;
    receiptLineId: string;
    receipt: { documentDate: Date | null; documentNumber: string | null };
  }> {
    if (batch.receiptLineId) {
      const existing = await this.prisma.goodsReceiptLine.findUnique({
        where: { id: batch.receiptLineId },
        select: {
          id: true,
          goodsReceiptId: true,
          receipt: { select: { documentDate: true, documentNumber: true } },
        },
      });
      if (existing) {
        return {
          receiptId: existing.goodsReceiptId,
          receiptLineId: existing.id,
          receipt: existing.receipt,
        };
      }
    }

    const compatible = await this.prisma.goodsReceiptLine.findFirst({
      where: {
        resourceId: batch.resourceId,
        warehouseId: batch.warehouseId,
        receipt: { partnerId: batch.supplierId },
        batch: { is: null },
      },
      orderBy: { id: "desc" },
      select: {
        id: true,
        goodsReceiptId: true,
        receipt: { select: { documentDate: true, documentNumber: true } },
      },
    });
    if (compatible) {
      return {
        receiptId: compatible.goodsReceiptId,
        receiptLineId: compatible.id,
        receipt: compatible.receipt,
      };
    }

    const unitPrice = formal.documentWeight.isZero()
      ? new Prisma.Decimal(0)
      : formal.acquisitionAmount.div(formal.documentWeight);
    const receipt = await this.prisma.goodsReceipt.create({
      data: {
        partnerId: batch.supplierId,
        documentDate: formal.documentDate,
        documentNumber: formal.documentNumber,
        lines: {
          create: [
            {
              resourceId: batch.resourceId,
              warehouseId: batch.warehouseId,
              quantity: formal.documentWeight,
              unit: "KG",
              unitPrice,
            },
          ],
        },
      },
      include: { lines: { select: { id: true } } },
    });
    const line = receipt.lines[0];
    if (!line) {
      throw new ConflictException({
        code: "RECEIPT_CREATE_FAILED",
        message: "Nepavyko sukurti pajamavimo įrašo.",
      });
    }
    return {
      receiptId: receipt.id,
      receiptLineId: line.id,
      receipt: {
        documentDate: receipt.documentDate,
        documentNumber: receipt.documentNumber,
      },
    };
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
  ): Promise<{ id: string; name: string }> {
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
    return { id: location.id, name: location.name };
  }

  /**
   * Load one bag within a batch and assert it is updatable: the batch must not be
   * `CONFIRMED` and the unit must still be `ACTIVE` (a voided unit is frozen).
   */
  private async loadCorrectableBag(batchId: string, bagId: string) {
    const bag = await this.prisma.bag.findFirst({
      where: { id: bagId, batchId },
      include: correctableBagInclude,
    });
    if (!bag) {
      throw new NotFoundException({
        code: "BAG_NOT_FOUND",
        message: "Maišas nerastas.",
      });
    }
    if (bag.batch.status === "CONFIRMED") {
      throw new ConflictException({
        code: "BATCH_CONFIRMED",
        message: "Patvirtintos partijos maišų keisti negalima.",
      });
    }
    if (bag.status === "VOIDED") {
      throw new BadRequestException({
        code: "BAG_VOIDED",
        message: "Anuliuotas maišas negali būti koreguojamas.",
      });
    }
    return bag;
  }
}
