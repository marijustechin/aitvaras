import { Prisma } from "@aitvaras/database";
import type {
  Bag,
  BagCorrection,
  BagCorrectionKind,
  BagStatus,
  Batch,
  BatchStatus,
  IncomingDelivery,
  ReceivingDiscrepancy,
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
  resourceId: string;
  warehouseId: string;
  status: string;
  documentWeight: Prisma.Decimal | null;
  documentPieces: number | null;
  acquisitionAmount: Prisma.Decimal | null;
  confirmedAt: Date | null;
  receiptLineId: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  delivery: DeliveryContext;
  resource: { name: string; category: { name: string } };
  warehouse: { name: string };
  createdBy: NamedPerson;
  receiptLine: {
    id: string;
    goodsReceiptId: string;
    receipt: { documentDate: Date | null; documentNumber: string | null };
  } | null;
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
  batchId: string;
  supplierId: string;
  measuredWeight: Prisma.Decimal;
  documentWeight: Prisma.Decimal;
  differenceWeight: Prisma.Decimal;
  status: string;
  createdById: string;
  createdAt: Date;
  settledAt: Date | null;
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
): Batch {
  return {
    id: record.id,
    code: record.code,
    deliveryId: record.deliveryId,
    deliveryCode: record.delivery.code,
    resourceId: record.resourceId,
    resourceName: record.resource.name,
    resourceCategoryName: record.resource.category.name,
    supplierId: record.delivery.supplierId,
    supplierName: record.delivery.supplier.name,
    warehouseId: record.warehouseId,
    warehouseName: record.warehouse.name,
    arrivalDate: record.delivery.arrivalDate.toISOString(),
    status: record.status as BatchStatus,
    documentWeight: record.documentWeight?.toString() ?? null,
    documentPieces: record.documentPieces,
    // Signed `measured − document` (positive = physically received more).
    difference:
      record.documentWeight === null
        ? null
        : summary.totalNetWeight.sub(record.documentWeight).toString(),
    hasOpenDiscrepancy,
    acquisitionAmount: record.acquisitionAmount?.toString() ?? null,
    receiptId: record.receiptLine?.goodsReceiptId ?? null,
    receiptLineId: record.receiptLineId,
    documentDate: record.receiptLine?.receipt.documentDate?.toISOString() ?? null,
    documentNumber: record.receiptLine?.receipt.documentNumber ?? null,
    confirmedAt: record.confirmedAt?.toISOString() ?? null,
    createdById: record.createdById,
    createdByName: displayName(record.createdBy),
    bagCount: summary.bagCount,
    totalNetWeight: summary.totalNetWeight.toString(),
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
    batchId: record.batchId,
    supplierId: record.supplierId,
    measuredWeight: record.measuredWeight.toString(),
    documentWeight: record.documentWeight.toString(),
    differenceWeight: record.differenceWeight.toString(),
    status: record.status as ReceivingDiscrepancyStatus,
    createdById: record.createdById,
    createdAt: record.createdAt.toISOString(),
    settledAt: record.settledAt?.toISOString() ?? null,
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
