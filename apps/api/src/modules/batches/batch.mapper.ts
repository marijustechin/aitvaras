import { Prisma } from "@aitvaras/database";
import type {
  Bag,
  BagCorrection,
  BagCorrectionKind,
  BagStatus,
  Batch,
  BatchItem,
  BatchItemStatus,
  BatchReceivingMode,
  BatchStatus,
  IncomingDelivery,
  PieceReconciliationRow,
  ReceivingDiscrepancy,
  ReceivingDiscrepancyKind,
  ReceivingDiscrepancyStatus,
} from "@aitvaras/contracts";

/** Minimal person identity used for display names. */
export interface NamedPerson {
  firstName: string;
  lastName: string;
}

/** Derived per-batch totals (never stored, never client-supplied). */
export interface BatchSummary {
  totalNetWeight: Prisma.Decimal;
  bagCount: number;
}

/** The delivery fields a batch inherits (supplier + arrival date). */
export interface DeliveryContext {
  code: string;
  supplierId: string;
  arrivalDate: Date;
  supplier: { name: string };
}

/** Row shape for a loaded batch (delivery + warehouse + receipt link). */
export interface BatchRecord {
  id: string;
  code: string;
  deliveryId: string;
  receivingMode: string;
  resourceId: string | null;
  warehouseId: string;
  status: string;
  documentWeight: Prisma.Decimal | null;
  documentPieces: number | null;
  acquisitionAmount: Prisma.Decimal | null;
  documentDate: Date | null;
  documentNumber: string | null;
  confirmedAt: Date | null;
  receiptLineId: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  delivery: DeliveryContext;
  resource: { name: string; category: { name: string } } | null;
  warehouse: { name: string };
  createdBy: NamedPerson;
  receiptLine: {
    id: string;
    goodsReceiptId: string;
    receipt: { documentDate: Date | null; documentNumber: string | null };
  } | null;
}

/** Derived active totals for a PIECE batch (never stored). */
export interface PieceSummary {
  itemLineCount: number;
  totalPieces: number;
}

/** Row shape for a loaded PIECE item line. */
export interface BatchItemRecord {
  id: string;
  barcode: string;
  batchId: string;
  resourceId: string;
  warehouseLocationId: string;
  quantity: number;
  status: string;
  voidedById: string | null;
  voidedAt: Date | null;
  voidReason: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  batch: { code: string };
  resource: { name: string };
  warehouseLocation: { name: string };
  createdBy: NamedPerson;
  voidedBy: NamedPerson | null;
}

/** Row shape for a loaded package/handling unit. */
export interface BagRecord {
  id: string;
  barcode: string;
  batchId: string;
  packagingTypeId: string;
  grossWeight: Prisma.Decimal;
  tareWeightKg: Prisma.Decimal;
  netWeight: Prisma.Decimal;
  status: string;
  warehouseLocationId: string;
  voidedById: string | null;
  voidedAt: Date | null;
  voidReason: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  batch: { code: string };
  packagingType: { name: string; tareWeightKg: Prisma.Decimal };
  warehouseLocation: { name: string };
  createdBy: NamedPerson;
  voidedBy: NamedPerson | null;
}

/** Row shape for a recorded handling-unit correction. */
export interface BagCorrectionRecord {
  id: string;
  bagId: string;
  kind: string;
  previousValue: string | null;
  newValue: string | null;
  reason: string | null;
  createdById: string;
  createdAt: Date;
  createdBy: NamedPerson;
  bag: { barcode: string };
}

/** Row shape for a recorded receiving discrepancy. */
export interface ReceivingDiscrepancyRecord {
  id: string;
  kind: string;
  batchId: string;
  resourceId: string | null;
  supplierId: string;
  measuredWeight: Prisma.Decimal | null;
  documentWeight: Prisma.Decimal | null;
  differenceWeight: Prisma.Decimal | null;
  actualPieces: number | null;
  documentPieces: number | null;
  differencePieces: number | null;
  status: string;
  createdById: string;
  createdAt: Date;
  settledAt: Date | null;
}

/** Row shape for a persisted PIECE reconciliation line. */
export interface PieceReconciliationLineRecord {
  id: string;
  batchId: string;
  resourceId: string;
  actualPieces: number;
  documentPieces: number;
  differencePieces: number;
  createdAt: Date;
  resource: { name: string };
}

/** Row shape for a loaded incoming delivery. */
export interface DeliveryRecord {
  id: string;
  code: string;
  supplierId: string;
  arrivalDate: Date;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  supplier: { name: string };
  createdBy: NamedPerson;
  expense: {
    transportAmount: Prisma.Decimal;
    customsAmount: Prisma.Decimal;
  } | null;
}

export function displayName(person: NamedPerson): string {
  return `${person.firstName} ${person.lastName}`.trim();
}

/**
 * Map a database batch to the shared public representation. Supplier and arrival
 * date are inherited from the owning delivery; the warehouse belongs to the
 * batch. `summary` totals are derived from the batch's active packages (never
 * stored). `difference` is the derived `documentWeight − totalWeight`, computed
 * with decimals at the same precision.
 */
export function toBatch(
  record: BatchRecord,
  summary: BatchSummary,
  hasOpenDiscrepancy = false,
  pieces: PieceSummary = { itemLineCount: 0, totalPieces: 0 },
): Batch {
  return {
    id: record.id,
    code: record.code,
    deliveryId: record.deliveryId,
    deliveryCode: record.delivery.code,
    receivingMode: record.receivingMode as BatchReceivingMode,
    resourceId: record.resourceId,
    resourceName: record.resource?.name ?? null,
    resourceCategoryName: record.resource?.category.name ?? null,
    supplierId: record.delivery.supplierId,
    supplierName: record.delivery.supplier.name,
    warehouseId: record.warehouseId,
    warehouseName: record.warehouse.name,
    arrivalDate: record.delivery.arrivalDate.toISOString(),
    status: record.status as BatchStatus,
    documentWeight: record.documentWeight?.toString() ?? null,
    documentPieces: record.documentPieces,
    // Signed `measured − document` (positive = physically received more).
    // Weight-only; PIECE batches have no measured/document weight.
    difference:
      record.documentWeight === null
        ? null
        : summary.totalNetWeight.sub(record.documentWeight).toString(),
    hasOpenDiscrepancy,
    acquisitionAmount: record.acquisitionAmount?.toString() ?? null,
    receiptId: record.receiptLine?.goodsReceiptId ?? null,
    receiptLineId: record.receiptLineId,
    // PIECE stores the document metadata on the batch; WEIGHT on the receipt.
    documentDate:
      record.documentDate?.toISOString() ??
      record.receiptLine?.receipt.documentDate?.toISOString() ??
      null,
    documentNumber:
      record.documentNumber ?? record.receiptLine?.receipt.documentNumber ?? null,
    confirmedAt: record.confirmedAt?.toISOString() ?? null,
    createdById: record.createdById,
    createdByName: displayName(record.createdBy),
    bagCount: summary.bagCount,
    totalNetWeight: summary.totalNetWeight.toString(),
    itemLineCount: pieces.itemLineCount,
    totalPieces: pieces.totalPieces,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

/** Map a PIECE item line to its public representation. */
export function toBatchItem(record: BatchItemRecord): BatchItem {
  return {
    id: record.id,
    barcode: record.barcode,
    batchId: record.batchId,
    batchCode: record.batch.code,
    resourceId: record.resourceId,
    resourceName: record.resource.name,
    warehouseLocationId: record.warehouseLocationId,
    warehouseLocationName: record.warehouseLocation.name,
    quantity: record.quantity,
    status: record.status as BatchItemStatus,
    voidedById: record.voidedById,
    voidedByName: record.voidedBy ? displayName(record.voidedBy) : null,
    voidedAt: record.voidedAt?.toISOString() ?? null,
    voidReason: record.voidReason,
    createdById: record.createdById,
    createdByName: displayName(record.createdBy),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

/** Map a loaded delivery to its public representation. */
export function toDelivery(
  record: DeliveryRecord,
  batchCount: number,
  pendingBatchCount: number,
): IncomingDelivery {
  return {
    id: record.id,
    code: record.code,
    supplierId: record.supplierId,
    supplierName: record.supplier.name,
    arrivalDate: record.arrivalDate.toISOString(),
    createdById: record.createdById,
    createdByName: displayName(record.createdBy),
    batchCount,
    pendingBatchCount,
    hasNonZeroExpenses: record.expense
      ? !record.expense.transportAmount.isZero() ||
        !record.expense.customsAmount.isZero()
      : false,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toBag(record: BagRecord): Bag {
  return {
    id: record.id,
    barcode: record.barcode,
    batchId: record.batchId,
    batchCode: record.batch.code,
    packagingTypeId: record.packagingTypeId,
    packagingTypeName: record.packagingType.name,
    tareWeightKg: record.tareWeightKg.toString(),
    grossWeight: record.grossWeight.toString(),
    netWeight: record.netWeight.toString(),
    status: record.status as BagStatus,
    warehouseLocationId: record.warehouseLocationId,
    warehouseLocationName: record.warehouseLocation.name,
    voidedById: record.voidedById,
    voidedByName: record.voidedBy ? displayName(record.voidedBy) : null,
    voidedAt: record.voidedAt?.toISOString() ?? null,
    voidReason: record.voidReason,
    createdById: record.createdById,
    createdByName: displayName(record.createdBy),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

/** Map a recorded receiving discrepancy to its public representation. */
export function toReceivingDiscrepancy(
  record: ReceivingDiscrepancyRecord,
): ReceivingDiscrepancy {
  return {
    id: record.id,
    kind: record.kind as ReceivingDiscrepancyKind,
    batchId: record.batchId,
    resourceId: record.resourceId,
    supplierId: record.supplierId,
    measuredWeight: record.measuredWeight?.toString() ?? null,
    documentWeight: record.documentWeight?.toString() ?? null,
    differenceWeight: record.differenceWeight?.toString() ?? null,
    actualPieces: record.actualPieces,
    documentPieces: record.documentPieces,
    differencePieces: record.differencePieces,
    status: record.status as ReceivingDiscrepancyStatus,
    createdById: record.createdById,
    createdAt: record.createdAt.toISOString(),
    settledAt: record.settledAt?.toISOString() ?? null,
  };
}

/** Map a persisted PIECE reconciliation line to a detail row. */
export function toPieceReconciliationRow(
  record: PieceReconciliationLineRecord,
): PieceReconciliationRow {
  return {
    resourceId: record.resourceId,
    resourceName: record.resource.name,
    actualPieces: record.actualPieces,
    documentPieces: record.documentPieces,
    differencePieces: record.differencePieces,
  };
}

/** Map a recorded correction to its public representation. */
export function toBagCorrection(record: BagCorrectionRecord): BagCorrection {
  return {
    id: record.id,
    bagId: record.bagId,
    bagBarcode: record.bag.barcode,
    kind: record.kind as BagCorrectionKind,
    previousValue: record.previousValue,
    newValue: record.newValue,
    reason: record.reason,
    createdById: record.createdById,
    createdByName: displayName(record.createdBy),
    createdAt: record.createdAt.toISOString(),
  };
}
