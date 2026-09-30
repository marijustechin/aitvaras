import { Prisma } from "@aitvaras/database";
import type {
  Bag,
  BagCorrection,
  BagCorrectionKind,
  BagStatus,
  Batch,
  BatchStatus,
  HandlingUnitKey,
} from "@aitvaras/contracts";

/** Minimal person identity used for display names. */
export interface NamedPerson {
  firstName: string;
  lastName: string;
}

/** Derived per-batch totals (never stored, never client-supplied). */
export interface BatchSummary {
  totalQuantity: Prisma.Decimal;
  bagCount: number;
  unit: HandlingUnitKey | null;
}

/** Row shape for a loaded batch (relations + receipt link). */
export interface BatchRecord {
  id: string;
  code: string;
  resourceId: string;
  supplierId: string;
  warehouseId: string;
  arrivalDate: Date;
  status: string;
  receiptLineId: string | null;
  documentWeight: Prisma.Decimal | null;
  acquisitionAmount: Prisma.Decimal | null;
  confirmedAt: Date | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  resource: { name: string; category: { name: string } };
  supplier: { name: string };
  warehouse: { name: string };
  createdBy: NamedPerson;
  receiptLine: {
    id: string;
    goodsReceiptId: string;
    receipt: { documentDate: Date | null; documentNumber: string | null };
  } | null;
}

/** Row shape for a loaded bag/handling unit. */
export interface BagRecord {
  id: string;
  barcode: string;
  batchId: string;
  quantity: Prisma.Decimal;
  unit: string;
  status: string;
  warehouseLocationId: string;
  voidedById: string | null;
  voidedAt: Date | null;
  voidReason: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  batch: { code: string };
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

export function displayName(person: NamedPerson): string {
  return `${person.firstName} ${person.lastName}`.trim();
}

/**
 * Map a database batch to the shared public representation. `summary` totals are
 * derived from the batch's units (never stored). `difference` is the derived
 * `documentWeight − totalQuantity` for a reconciled (KG) batch, computed with
 * decimals at the same precision.
 */
export function toBatch(record: BatchRecord, summary: BatchSummary): Batch {
  return {
    id: record.id,
    code: record.code,
    resourceId: record.resourceId,
    resourceName: record.resource.name,
    resourceCategoryName: record.resource.category.name,
    supplierId: record.supplierId,
    supplierName: record.supplier.name,
    warehouseId: record.warehouseId,
    warehouseName: record.warehouse.name,
    arrivalDate: record.arrivalDate.toISOString(),
    status: record.status as BatchStatus,
    unit: summary.unit,
    documentWeight: record.documentWeight?.toString() ?? null,
    difference:
      record.documentWeight?.sub(summary.totalQuantity).toString() ?? null,
    acquisitionAmount: record.acquisitionAmount?.toString() ?? null,
    receiptId: record.receiptLine?.goodsReceiptId ?? null,
    receiptLineId: record.receiptLineId,
    documentDate: record.receiptLine?.receipt.documentDate?.toISOString() ?? null,
    documentNumber: record.receiptLine?.receipt.documentNumber ?? null,
    confirmedAt: record.confirmedAt?.toISOString() ?? null,
    createdById: record.createdById,
    createdByName: displayName(record.createdBy),
    bagCount: summary.bagCount,
    totalQuantity: summary.totalQuantity.toString(),
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
    quantity: record.quantity.toString(),
    unit: record.unit as HandlingUnitKey,
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
