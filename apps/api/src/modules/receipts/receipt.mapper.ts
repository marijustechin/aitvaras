import { Prisma } from "@aitvaras/database";
import type { GoodsReceipt, MeasurementUnitKey } from "@aitvaras/contracts";

/** Row shape for a loaded receipt line. */
export interface ReceiptLineRecord {
  id: string;
  resourceId: string;
  quantity: Prisma.Decimal;
  unit: string;
  unitPrice: Prisma.Decimal;
  warehouseId: string;
  warehouseLocationId: string | null;
  resource: { name: string };
  warehouse: { name: string };
  warehouseLocation: { name: string } | null;
}

/** Row shape for a loaded receipt (partner + lines + resources). */
export interface ReceiptRecord {
  id: string;
  partnerId: string;
  createdAt: Date;
  updatedAt: Date;
  partner: { name: string };
  lines: ReceiptLineRecord[];
}

/** Derived line total (quantity × unit price), computed with decimals. */
export function lineTotal(
  quantity: Prisma.Decimal,
  unitPrice: Prisma.Decimal,
): Prisma.Decimal {
  return quantity.mul(unitPrice);
}

/**
 * Map a database receipt to the shared public representation.
 *
 * Totals are derived from stored decimals (never client-supplied) and serialised
 * as strings so quantities/prices never pass through floating point.
 */
export function toGoodsReceipt(record: ReceiptRecord): GoodsReceipt {
  const lines = record.lines.map((line) => ({
    id: line.id,
    resourceId: line.resourceId,
    resourceName: line.resource.name,
    quantity: line.quantity.toString(),
    unit: line.unit as MeasurementUnitKey,
    unitPrice: line.unitPrice.toString(),
    warehouseId: line.warehouseId,
    warehouseName: line.warehouse.name,
    warehouseLocationId: line.warehouseLocationId,
    warehouseLocationName: line.warehouseLocation?.name ?? null,
    lineTotal: lineTotal(line.quantity, line.unitPrice).toString(),
  }));

  const total = record.lines.reduce(
    (sum, line) => sum.add(lineTotal(line.quantity, line.unitPrice)),
    new Prisma.Decimal(0),
  );

  return {
    id: record.id,
    partnerId: record.partnerId,
    partnerName: record.partner.name,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    lines,
    total: total.toString(),
  };
}
