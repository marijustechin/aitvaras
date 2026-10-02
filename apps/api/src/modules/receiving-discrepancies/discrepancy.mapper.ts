import { Prisma } from "@aitvaras/database";
import {
  discrepancyDirection,
  type DiscrepancySettlement,
  type DiscrepancySettlementType,
  type ReceivingDiscrepancyDetail,
  type ReceivingDiscrepancyRegisterRow,
  type ReceivingDiscrepancyStatus,
} from "@aitvaras/contracts";

function displayName(person: { firstName: string; lastName: string }): string {
  return `${person.firstName} ${person.lastName}`.trim();
}

/** A settlement with its creator and (optional) linked source batch/delivery. */
export const settlementInclude = {
  createdBy: true,
  sourceBatch: { include: { delivery: true } },
} satisfies Prisma.DiscrepancySettlementInclude;

/** A discrepancy with its origin context (supplier + batch → delivery/resource/warehouse). */
export const discrepancyBaseInclude = {
  supplier: true,
  createdBy: true,
  batch: {
    include: { delivery: true, resource: true, warehouse: true },
  },
} satisfies Prisma.ReceivingDiscrepancyInclude;

/** List shape: only the settlement weights are needed to derive the balance. */
export const discrepancyListInclude = {
  ...discrepancyBaseInclude,
  settlements: { select: { coveredWeightKg: true } },
} satisfies Prisma.ReceivingDiscrepancyInclude;

/** Detail shape: full settlement history, oldest first. */
export const discrepancyDetailInclude = {
  ...discrepancyBaseInclude,
  settlements: { include: settlementInclude, orderBy: { createdAt: "asc" } },
} satisfies Prisma.ReceivingDiscrepancyInclude;

type SettlementRecord = Prisma.DiscrepancySettlementGetPayload<{
  include: typeof settlementInclude;
}>;
type ListRecord = Prisma.ReceivingDiscrepancyGetPayload<{
  include: typeof discrepancyListInclude;
}>;
type DetailRecord = Prisma.ReceivingDiscrepancyGetPayload<{
  include: typeof discrepancyDetailInclude;
}>;

/** Absolute value of a signed decimal (the original discrepancy magnitude). */
export function absDecimal(value: Prisma.Decimal): Prisma.Decimal {
  return value.isNegative() ? value.negated() : value;
}

/** Derived, server-calculated settlement balance. */
export function settlementBalance(
  differenceWeight: Prisma.Decimal,
  settlements: readonly { coveredWeightKg: Prisma.Decimal }[],
): {
  originalWeight: Prisma.Decimal;
  settledWeight: Prisma.Decimal;
  remainingWeight: Prisma.Decimal;
} {
  const originalWeight = absDecimal(differenceWeight);
  const settledWeight = settlements.reduce(
    (sum, entry) => sum.plus(entry.coveredWeightKg),
    new Prisma.Decimal(0),
  );
  return {
    originalWeight,
    settledWeight,
    remainingWeight: originalWeight.minus(settledWeight),
  };
}

/** Map a settlement ledger entry to its public representation. */
export function toSettlement(record: SettlementRecord): DiscrepancySettlement {
  return {
    id: record.id,
    discrepancyId: record.discrepancyId,
    type: record.type as DiscrepancySettlementType,
    coveredWeightKg: record.coveredWeightKg.toString(),
    moneyAmount: record.moneyAmount?.toString() ?? null,
    currency: record.currency ?? null,
    sourceBatchId: record.sourceBatchId ?? null,
    sourceBatchCode: record.sourceBatch?.code ?? null,
    sourceDeliveryCode: record.sourceBatch?.delivery.code ?? null,
    reference: record.reference ?? null,
    note: record.note ?? null,
    createdById: record.createdById,
    createdByName: displayName(record.createdBy),
    createdAt: record.createdAt.toISOString(),
  };
}

/** Map a discrepancy (with settlements) to a register row + derived balance. */
export function toRegisterRow(
  record: ListRecord | DetailRecord,
): ReceivingDiscrepancyRegisterRow {
  const differenceWeight = record.differenceWeight.toString();
  const balance = settlementBalance(record.differenceWeight, record.settlements);
  return {
    id: record.id,
    batchId: record.batchId,
    deliveryId: record.batch.deliveryId,
    deliveryCode: record.batch.delivery.code,
    batchCode: record.batch.code,
    supplierId: record.supplierId,
    supplierName: record.supplier.name,
    resourceId: record.batch.resourceId,
    resourceName: record.batch.resource.name,
    warehouseName: record.batch.warehouse.name,
    arrivalDate: record.batch.delivery.arrivalDate.toISOString(),
    measuredWeight: record.measuredWeight.toString(),
    documentWeight: record.documentWeight.toString(),
    differenceWeight,
    direction: discrepancyDirection(differenceWeight),
    originalWeight: balance.originalWeight.toString(),
    settledWeight: balance.settledWeight.toString(),
    remainingWeight: balance.remainingWeight.toString(),
    status: record.status as ReceivingDiscrepancyStatus,
    createdById: record.createdById,
    createdByName: displayName(record.createdBy),
    createdAt: record.createdAt.toISOString(),
    settledAt: record.settledAt?.toISOString() ?? null,
  };
}

/** Map a discrepancy with its settlement history to the detail representation. */
export function toDetail(record: DetailRecord): ReceivingDiscrepancyDetail {
  return {
    ...toRegisterRow(record),
    settlements: record.settlements.map(toSettlement),
  };
}
