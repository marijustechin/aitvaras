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
  CreateIncomingDeliveryRequest,
  IncomingDelivery,
  IncomingDeliveryDetail,
  ReconcileBatchRequest,
  ResolveBatchRequest,
  UpdateBagRequest,
  VoidBagRequest,
} from "@aitvaras/contracts";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { generateBagBarcode } from "./bag-barcode";
import {
  formatBatchCode,
  MAX_BATCH_SEQUENCE,
  parseBatchSequence,
} from "./batch-code";
import {
  toBag,
  toBagCorrection,
  toBatch,
  toDelivery,
  toReceivingDiscrepancy,
  type BatchSummary,
} from "./batch.mapper";
import {
  deliveryCodePrefix,
  formatDeliveryCode,
  MAX_DELIVERY_SEQUENCE,
  parseDeliverySequence,
} from "./delivery-code";

const MAX_CODE_ATTEMPTS = 5;
const MAX_BARCODE_ATTEMPTS = 5;

/** Batch include with the delivery + warehouse context the public shape uses. */
const batchInclude = {
  delivery: {
    select: {
      code: true,
      supplierId: true,
      arrivalDate: true,
      supplier: { select: { name: true } },
    },
  },
  resource: { include: { category: true } },
  warehouse: { select: { name: true } },
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
  packagingType: true,
  warehouseLocation: true,
  createdBy: true,
  voidedBy: true,
} satisfies Prisma.BagInclude;

/** Bag include for a correction: also needs the batch's status/warehouse. */
const correctableBagInclude = {
  batch: {
    select: { code: true, status: true, warehouseId: true },
  },
  packagingType: true,
  warehouseLocation: true,
  createdBy: true,
  voidedBy: true,
} satisfies Prisma.BagInclude;

const bagCorrectionInclude = {
  createdBy: true,
  bag: { select: { barcode: true } },
} satisfies Prisma.BagCorrectionInclude;

const deliveryInclude = {
  supplier: true,
  createdBy: true,
} satisfies Prisma.IncomingDeliveryInclude;

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function emptySummary(): BatchSummary {
  return { totalNetWeight: new Prisma.Decimal(0), bagCount: 0 };
}

/**
 * Physical receiving aggregate: incoming deliveries (Gavimai), their internal
 * batches (Partijos) and the physical packages / handling units (Maišai) inside
 * each batch.
 *
 * An IncomingDelivery is ONE physical arrival of one supplier on one arrival date
 * and may contain several resources; each Batch is one resource into one
 * warehouse. Physical receiving is weight-based. Totals are always derived from
 * the active packages, never stored or client-supplied.
 */
@Injectable()
export class BatchesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Deliveries (Gavimai) ────────────────────────────────────────────────

  /**
   * Start a new delivery. The delivery code `GYYMM-NN` is generated here (a
   * per-month sequence); a database unique-conflict is retried. Supplier must be
   * an active SUPPLIER (validated server-side).
   */
  async createDelivery(
    input: CreateIncomingDeliveryRequest,
    actorId: string,
  ): Promise<IncomingDelivery> {
    await this.assertActiveSupplier(input.supplierId);
    const arrivalDate = new Date(input.arrivalDate);
    const now = new Date();

    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
      const code = await this.nextDeliveryCode(now);
      try {
        const delivery = await this.prisma.incomingDelivery.create({
          data: {
            code,
            supplierId: input.supplierId,
            arrivalDate,
            createdById: actorId,
          },
          include: deliveryInclude,
        });
        return toDelivery(delivery, 0, 0);
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          continue;
        }
        throw error;
      }
    }

    throw new ConflictException(
      "Nepavyko sugeneruoti unikalaus gavimo kodo.",
    );
  }

  /**
   * All deliveries, newest first, with derived batch counts. `pendingBatchCount`
   * is computed from the child batches (a delivery with no batches counts as
   * open work); the open receiving queue filters on it rather than a stored
   * delivery status.
   */
  async listDeliveries(): Promise<IncomingDelivery[]> {
    const deliveries = await this.prisma.incomingDelivery.findMany({
      include: deliveryInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    if (deliveries.length === 0) {
      return [];
    }
    const groups = await this.prisma.batch.groupBy({
      by: ["deliveryId", "status"],
      where: { deliveryId: { in: deliveries.map((delivery) => delivery.id) } },
      _count: { _all: true },
    });
    const totalByDelivery = new Map<string, number>();
    const pendingByDelivery = new Map<string, number>();
    for (const group of groups) {
      totalByDelivery.set(
        group.deliveryId,
        (totalByDelivery.get(group.deliveryId) ?? 0) + group._count._all,
      );
      if (group.status === "PENDING") {
        pendingByDelivery.set(group.deliveryId, group._count._all);
      }
    }
    return deliveries.map((delivery) =>
      toDelivery(
        delivery,
        totalByDelivery.get(delivery.id) ?? 0,
        pendingByDelivery.get(delivery.id) ?? 0,
      ),
    );
  }

  /** One delivery with the batches (resource/warehouse groups) it contains. */
  async getDelivery(id: string): Promise<IncomingDeliveryDetail> {
    const delivery = await this.prisma.incomingDelivery.findUnique({
      where: { id },
      include: deliveryInclude,
    });
    if (!delivery) {
      throw new NotFoundException({
        code: "DELIVERY_NOT_FOUND",
        message: "Gavimas nerastas.",
      });
    }
    const batches = await this.listByDelivery(id);
    const pendingBatchCount = batches.filter(
      (batch) => batch.status === "PENDING",
    ).length;
    return {
      ...toDelivery(delivery, batches.length, pendingBatchCount),
      batches,
    };
  }

  /**
   * Start or resolve the internal batch for one resource + warehouse within a
   * delivery. If the exact `(delivery, resource, warehouse)` batch already exists
   * it is returned; otherwise a new `PENDING` batch is created. Concurrency-safe
   * via the `(deliveryId, resourceId, warehouseId)` unique constraint.
   */
  async resolveBatch(
    deliveryId: string,
    input: ResolveBatchRequest,
    actorId: string,
  ): Promise<BatchDetail> {
    const delivery = await this.prisma.incomingDelivery.findUnique({
      where: { id: deliveryId },
      select: { id: true },
    });
    if (!delivery) {
      throw new NotFoundException({
        code: "DELIVERY_NOT_FOUND",
        message: "Gavimas nerastas.",
      });
    }
    await this.assertActiveResource(input.resourceId);
    await this.assertActiveWarehouse(input.warehouseId);

    const where = {
      deliveryId_resourceId_warehouseId: {
        deliveryId,
        resourceId: input.resourceId,
        warehouseId: input.warehouseId,
      },
    };
    const existing = await this.prisma.batch.findUnique({
      where,
      select: { id: true },
    });
    if (existing) {
      return this.get(existing.id);
    }

    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
      const code = await this.nextBatchCode(deliveryId);
      try {
        const created = await this.prisma.batch.create({
          data: {
            code,
            deliveryId,
            resourceId: input.resourceId,
            warehouseId: input.warehouseId,
            createdById: actorId,
          },
          select: { id: true },
        });
        return this.get(created.id);
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          const raced = await this.prisma.batch.findUnique({
            where,
            select: { id: true },
          });
          if (raced) {
            return this.get(raced.id);
          }
          continue;
        }
        throw error;
      }
    }

    throw new ConflictException(
      "Nepavyko sugeneruoti unikalaus partijos kodo.",
    );
  }

  // ── Batches ─────────────────────────────────────────────────────────────

  /**
   * All batches, newest first (deterministic), optionally filtered by status.
   * Totals are derived from the active packages, never stored.
   */
  async list(status?: BatchStatus): Promise<Batch[]> {
    const batches = await this.prisma.batch.findMany({
      where: status ? { status } : undefined,
      include: batchInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return this.withSummaries(batches);
  }

  /** The batches of one delivery, oldest first (registration order). */
  async listByDelivery(deliveryId: string): Promise<Batch[]> {
    const batches = await this.prisma.batch.findMany({
      where: { deliveryId },
      include: batchInclude,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return this.withSummaries(batches);
  }

  /** One batch with its packages. */
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
    // measured weight or the active unit count.
    const activeBags = bags.filter((bag) => bag.status === "ACTIVE");
    const totalNetWeight = activeBags.reduce(
      (sum, bag) => sum.add(bag.netWeight),
      new Prisma.Decimal(0),
    );
    const lastActiveBag = activeBags[activeBags.length - 1];

    const corrections = await this.prisma.bagCorrection.findMany({
      where: { bag: { batchId: id } },
      include: bagCorrectionInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });

    const discrepancies = await this.prisma.receivingDiscrepancy.findMany({
      where: { batchId: id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });

    return {
      ...toBatch(
        batch,
        { totalNetWeight, bagCount: activeBags.length },
        discrepancies.some((row) => row.status !== "SETTLED"),
      ),
      bags: bags.map(toBag),
      corrections: corrections.map(toBagCorrection),
      discrepancies: discrepancies.map(toReceivingDiscrepancy),
      suggestedLocationId: lastActiveBag
        ? lastActiveBag.warehouseLocationId
        : null,
      suggestedPackagingTypeId: lastActiveBag
        ? lastActiveBag.packagingTypeId
        : null,
    };
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
   * Add one physical package to a not-yet-confirmed batch. The worker enters the
   * gross weight and selects an ACTIVE packaging type; the server derives
   * `netWeight = grossWeight − packagingType.tareWeightKg` (never client-supplied)
   * and rejects a gross weight not above the tare. A location must exist, be
   * active and belong to the batch's warehouse. The barcode is generated here; a
   * database unique-conflict is retried.
   */
  async createBag(
    batchId: string,
    input: CreateBagRequest,
    actorId: string,
  ): Promise<Bag> {
    const batch = await this.prisma.batch.findUnique({
      where: { id: batchId },
      select: { id: true, status: true, warehouseId: true },
    });
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
    const packagingType = await this.assertActivePackagingType(
      input.packagingTypeId,
    );
    const grossWeight = new Prisma.Decimal(input.grossWeight);
    const netWeight = grossWeight.sub(packagingType.tareWeightKg);
    if (netWeight.lte(0)) {
      throw new BadRequestException({
        code: "GROSS_NOT_ABOVE_TARE",
        message: "Bruto svoris turi būti didesnis už taros svorį.",
      });
    }

    for (let attempt = 0; attempt < MAX_BARCODE_ATTEMPTS; attempt += 1) {
      const barcode = generateBagBarcode();
      try {
        const bag = await this.prisma.bag.create({
          data: {
            barcode,
            batchId,
            packagingTypeId: packagingType.id,
            grossWeight,
            // Snapshot the tare used for this net calculation, so later edits to
            // the PackagingType master record cannot change historical net.
            tareWeightKg: packagingType.tareWeightKg,
            netWeight,
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
   * Correct one active handling unit (packaging type, gross weight and/or
   * location) while the batch is not yet `CONFIRMED`. Changing the packaging type
   * or the gross weight recomputes `netWeight` server-side. Each effective change
   * is recorded as an auditable `BagCorrection` (`PACKAGING`/`GROSS_WEIGHT`/
   * `LOCATION`); a no-op returns the unit unchanged with no trail. The batch
   * status is not changed here.
   */
  async correctBag(
    batchId: string,
    bagId: string,
    input: UpdateBagRequest,
    actorId: string,
  ): Promise<Bag> {
    const bag = await this.loadCorrectableBag(batchId, bagId);
    const data: Prisma.BagUpdateInput = {};
    const corrections: Prisma.BagCorrectionCreateManyInput[] = [];

    // The tare to apply after the correction: the package's current snapshot by
    // default, re-snapshotted from the selected PackagingType when it changes.
    let tareWeightKg = bag.tareWeightKg;
    let weightChanged = false;

    if (
      input.packagingTypeId !== undefined &&
      input.packagingTypeId !== bag.packagingTypeId
    ) {
      const next = await this.assertActivePackagingType(input.packagingTypeId);
      data.packagingType = { connect: { id: next.id } };
      // Record both packaging names and their tare values so the previous/new
      // tare state stays understandable in the audit trail.
      corrections.push({
        bagId: bag.id,
        kind: "PACKAGING",
        previousValue: `${bag.packagingType.name} (${bag.tareWeightKg.toString()} kg)`,
        newValue: `${next.name} (${next.tareWeightKg.toString()} kg)`,
        createdById: actorId,
      });
      tareWeightKg = next.tareWeightKg;
      weightChanged = true;
    }

    let grossWeight = bag.grossWeight;
    if (input.grossWeight !== undefined) {
      const next = new Prisma.Decimal(input.grossWeight);
      if (!next.equals(bag.grossWeight)) {
        corrections.push({
          bagId: bag.id,
          kind: "GROSS_WEIGHT",
          previousValue: bag.grossWeight.toString(),
          newValue: next.toString(),
          createdById: actorId,
        });
        grossWeight = next;
        weightChanged = true;
      }
    }

    if (weightChanged) {
      const netWeight = grossWeight.sub(tareWeightKg);
      if (netWeight.lte(0)) {
        throw new BadRequestException({
          code: "GROSS_NOT_ABOVE_TARE",
          message: "Bruto svoris turi būti didesnis už taros svorį.",
        });
      }
      data.grossWeight = grossWeight;
      data.tareWeightKg = tareWeightKg;
      data.netWeight = netWeight;
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
   * it is excluded from the measured weight. Who/when/why is recorded.
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
          previousValue: bag.netWeight.toString(),
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
   * Confirm a batch against the formal GoodsReceipt (Eimantas' documentary
   * confirmation). Resolves or creates the internal receipt-line anchor from the
   * batch context and the formal data (`resolveReceiptLine`), records the accepted
   * documentary weight/acquisition value/optional pieces, and confirms the batch.
   *
   * A documentary/physical mismatch does **not** block confirmation: the batch
   * still becomes `CONFIRMED` (the physical stock stays the measured net weight)
   * and the client must explicitly acknowledge the mismatch
   * (`acknowledgeDiscrepancy`), which records a separate, long-lived
   * `ReceivingDiscrepancy`. The difference is signed `measured − document`.
   *
   * The measured weight is always derived from the batch's active packages here —
   * it is never sent by the client. Reconciliation creates **no** new packages and
   * no stock. `CONFIRMED` is terminal; the confirm + discrepancy creation are one
   * transaction and a retry cannot create a duplicate discrepancy.
   */
  async reconcile(
    batchId: string,
    input: ReconcileBatchRequest,
    actorId: string,
  ): Promise<BatchReconciliation> {
    const batch = await this.prisma.batch.findUnique({
      where: { id: batchId },
      include: {
        delivery: { select: { supplierId: true } },
      },
    });
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
      select: { netWeight: true },
    });
    if (bags.length === 0) {
      throw new BadRequestException({
        code: "BATCH_EMPTY",
        message: "Partijoje dar nėra nė vienos pakuotės.",
      });
    }
    const bagCount = bags.length;
    const measuredWeight = bags.reduce(
      (sum, bag) => sum.add(bag.netWeight),
      new Prisma.Decimal(0),
    );

    const documentWeight = new Prisma.Decimal(input.documentWeight);
    const acquisitionAmount = new Prisma.Decimal(input.acquisitionAmount);
    const documentPieces = input.documentPieces ?? null;
    // Signed convention: measured − document (positive = received more).
    const difference = measuredWeight.sub(documentWeight);

    if (!difference.isZero() && input.acknowledgeDiscrepancy !== true) {
      throw new BadRequestException({
        code: "DISCREPANCY_NOT_ACKNOWLEDGED",
        message: "Svorio neatitikimas turi būti patvirtintas.",
      });
    }

    const requestedDocumentDate = input.documentDate
      ? new Date(input.documentDate)
      : null;
    const requestedDocumentNumber = input.documentNumber ?? null;
    const confirmedAt = new Date();

    // Resolve or create the internal formal-document anchor from the batch
    // context and formal data — the client never selects a receipt line.
    const anchor = await this.resolveReceiptLine(
      {
        resourceId: batch.resourceId,
        supplierId: batch.delivery.supplierId,
        warehouseId: batch.warehouseId,
        receiptLineId: batch.receiptLineId,
      },
      {
        documentWeight,
        acquisitionAmount,
        documentDate: requestedDocumentDate,
        documentNumber: requestedDocumentNumber,
      },
    );

    const discrepancy = await this.prisma.$transaction(async (tx) => {
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

      // Conditional update: a concurrent/retried confirmation of an already
      // confirmed batch affects no rows and therefore cannot create a duplicate
      // discrepancy.
      const result = await tx.batch.updateMany({
        where: { id: batchId, status: { not: "CONFIRMED" } },
        data: {
          receiptLineId: anchor.receiptLineId,
          documentWeight,
          documentPieces,
          acquisitionAmount,
          status: "CONFIRMED",
          confirmedAt,
        },
      });
      if (result.count === 0) {
        throw new ConflictException({
          code: "BATCH_ALREADY_CONFIRMED",
          message:
            "Partija jau patvirtinta ir negali būti patvirtinta pakartotinai.",
        });
      }

      if (difference.isZero()) {
        return null;
      }
      return tx.receivingDiscrepancy.create({
        data: {
          batchId,
          supplierId: batch.delivery.supplierId,
          measuredWeight,
          documentWeight,
          differenceWeight: difference,
          createdById: actorId,
        },
        select: { id: true },
      });
    });

    const updated = await this.prisma.batch.findUniqueOrThrow({
      where: { id: batchId },
      include: batchInclude,
    });

    return {
      batchId: updated.id,
      code: updated.code,
      status: "CONFIRMED",
      bagCount,
      measuredWeight: measuredWeight.toString(),
      documentWeight: documentWeight.toString(),
      documentPieces,
      difference: difference.toString(),
      discrepancyId: discrepancy?.id ?? null,
      acquisitionAmount: acquisitionAmount.toString(),
      receiptId: anchor.receiptId,
      receiptLineId: anchor.receiptLineId,
      documentDate:
        updated.receiptLine?.receipt.documentDate?.toISOString() ?? null,
      documentNumber: updated.receiptLine?.receipt.documentNumber ?? null,
      confirmedAt: confirmedAt.toISOString(),
    };
  }

  // ── Internals ───────────────────────────────────────────────────────────

  /** Attach derived active totals + open-discrepancy flag to loaded batches. */
  private async withSummaries(
    batches: (BatchRecordLike & { id: string })[],
  ): Promise<Batch[]> {
    const summaries = await this.summariesFor(batches.map((batch) => batch.id));
    const openDiscrepancies = await this.openDiscrepancyBatchIds(
      batches.map((batch) => batch.id),
    );
    return batches.map((batch) =>
      toBatch(
        batch,
        summaries.get(batch.id) ?? emptySummary(),
        openDiscrepancies.has(batch.id),
      ),
    );
  }

  /** The batch ids (from the given set) that have a not-yet-settled discrepancy. */
  private async openDiscrepancyBatchIds(
    batchIds: string[],
  ): Promise<Set<string>> {
    if (batchIds.length === 0) {
      return new Set();
    }
    const rows = await this.prisma.receivingDiscrepancy.findMany({
      where: { batchId: { in: batchIds }, status: { not: "SETTLED" } },
      select: { batchId: true },
    });
    return new Set(rows.map((row) => row.batchId));
  }

  /** Derive active bag count + total weight for the given batches. */
  private async summariesFor(
    batchIds: string[],
  ): Promise<Map<string, BatchSummary>> {
    if (batchIds.length === 0) {
      return new Map();
    }
    const groups = await this.prisma.bag.groupBy({
      by: ["batchId"],
      where: { batchId: { in: batchIds }, status: "ACTIVE" },
      _sum: { netWeight: true },
      _count: { _all: true },
    });
    return new Map(
      groups.map((group) => [
        group.batchId,
        {
          totalNetWeight: group._sum.netWeight ?? new Prisma.Decimal(0),
          bagCount: group._count._all,
        },
      ]),
    );
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
   * batch.
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

  /**
   * Next delivery-local batch code `P<NN>`, scoped to the delivery and never
   * exceeding `P99`. Uniqueness within the delivery is enforced by the
   * `(deliveryId, code)` constraint plus retry in `resolveBatch`.
   */
  private async nextBatchCode(deliveryId: string): Promise<string> {
    const last = await this.prisma.batch.findFirst({
      where: { deliveryId, code: { startsWith: "P" } },
      orderBy: { code: "desc" },
      select: { code: true },
    });
    const sequence = last ? (parseBatchSequence(last.code) ?? 0) : 0;
    const next = sequence + 1;
    if (next > MAX_BATCH_SEQUENCE) {
      throw new ConflictException({
        code: "BATCH_CODE_EXHAUSTED",
        message:
          "Šio gavimo partijų kodų riba (99) pasiekta. Kreipkitės į administratorių.",
      });
    }
    return formatBatchCode(next);
  }

  /** Next delivery code `GYYMM-NN` for the given month; never exceeds 99. */
  private async nextDeliveryCode(date: Date): Promise<string> {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const prefix = deliveryCodePrefix(year, month);
    const last = await this.prisma.incomingDelivery.findFirst({
      where: { code: { startsWith: prefix } },
      orderBy: { code: "desc" },
      select: { code: true },
    });
    const sequence = last
      ? (parseDeliverySequence(last.code, year, month) ?? 0)
      : 0;
    const next = sequence + 1;
    if (next > MAX_DELIVERY_SEQUENCE) {
      throw new ConflictException({
        code: "DELIVERY_CODE_EXHAUSTED",
        message:
          "Šio mėnesio gavimų kodų riba (99) pasiekta. Kreipkitės į administratorių.",
      });
    }
    return formatDeliveryCode(year, month, next);
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

  /**
   * Load an ACTIVE packaging type for a new registration or correction. An
   * inactive packaging type may not be selected for new receiving (historical
   * packages may still reference an inactive type).
   */
  private async assertActivePackagingType(packagingTypeId: string) {
    const packagingType = await this.prisma.packagingType.findUnique({
      where: { id: packagingTypeId },
    });
    if (!packagingType) {
      throw new BadRequestException("Pasirinkta tara nerasta.");
    }
    if (!packagingType.active) {
      throw new BadRequestException({
        code: "PACKAGING_INACTIVE",
        message: "Pasirinkta tara neaktyvi.",
      });
    }
    return packagingType;
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

/** A loaded batch row (structural alias for the mapper's record type). */
type BatchRecordLike = Parameters<typeof toBatch>[0];
