import { Prisma } from "@aitvaras/database";
import type { Bag, Batch, BatchStatus } from "@aitvaras/contracts";

/** Minimal person identity used for display names. */
export interface NamedPerson {
  firstName: string;
  lastName: string;
}

/** Row shape for a loaded batch (relations + bag count). */
export interface BatchRecord {
  id: string;
  code: string;
  resourceId: string;
  supplierId: string;
  warehouseId: string;
  arrivalDate: Date;
  status: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  resource: { name: string };
  supplier: { name: string };
  warehouse: { name: string };
  createdBy: NamedPerson;
  _count: { bags: number };
}

/** Row shape for a loaded bag. */
export interface BagRecord {
  id: string;
  barcode: string;
  batchId: string;
  weight: Prisma.Decimal;
  warehouseLocationId: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  batch: { code: string };
  warehouseLocation: { name: string } | null;
  createdBy: NamedPerson;
}

export function displayName(person: NamedPerson): string {
  return `${person.firstName} ${person.lastName}`.trim();
}

/**
 * Map a database batch to the shared public representation. `totalWeight` is
 * derived from the batch's bags (never client-supplied) and serialised as a
 * decimal string so weights never pass through floating point.
 */
export function toBatch(record: BatchRecord, totalWeight: Prisma.Decimal): Batch {
  return {
    id: record.id,
    code: record.code,
    resourceId: record.resourceId,
    resourceName: record.resource.name,
    supplierId: record.supplierId,
    supplierName: record.supplier.name,
    warehouseId: record.warehouseId,
    warehouseName: record.warehouse.name,
    arrivalDate: record.arrivalDate.toISOString(),
    status: record.status as BatchStatus,
    createdById: record.createdById,
    createdByName: displayName(record.createdBy),
    bagCount: record._count.bags,
    totalWeight: totalWeight.toString(),
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
    weight: record.weight.toString(),
    warehouseLocationId: record.warehouseLocationId,
    warehouseLocationName: record.warehouseLocation?.name ?? null,
    createdById: record.createdById,
    createdByName: displayName(record.createdBy),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
