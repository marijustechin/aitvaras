import { Prisma } from "@aitvaras/database";
import {
  discrepancyDirection,
  type DiscrepancySettlement,
  type DiscrepancySettlementType,
  type ReceivingDiscrepancyDetail,
  type ReceivingDiscrepancyKind,
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

/** A discrepancy with its origin context (supplier + batch → delivery/warehouse + PIECE resource). */
export const discrepancyBaseInclude = {
  supplier: true,
  resource: true,
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
  const kind = record.kind as ReceivingDiscrepancyKind;
  // PIECE discrepancies carry the product on their own resource relation; WEIGHT
  // discrepancies have no resource (the batch owns it).
  const resourceId = record.resourceId ?? record.batch.resourceId ?? null;
  const resourceName =
    record.resource?.name ?? record.batch.resource?.name ?? null;
  // Signed display value: pieces for PIECE, weight for WEIGHT.
  const signedDifference =
    kind === "PIECE"
      ? (record.differencePieces ?? 0).toString()
      : (record.differenceWeight?.toString() ?? "0");
  const balance =
    kind === "WEIGHT" && record.differenceWeight !== null
      ? settlementBalance(record.differenceWeight, record.settlements)
      : null;
  return {
    id: record.id,
    kind,
    batchId: record.batchId,
    deliveryId: record.batch.deliveryId,
    deliveryCode: record.batch.delivery.code,
    batchCode: record.batch.code,
    supplierId: record.supplierId,
    supplierName: record.supplier.name,
    resourceId,
    resourceName,
    warehouseName: record.batch.warehouse.name,
    arrivalDate: record.batch.delivery.arrivalDate.toISOString(),
    measuredWeight: record.measuredWeight?.toString() ?? null,
    documentWeight: record.documentWeight?.toString() ?? null,
    differenceWeight: record.differenceWeight?.toString() ?? null,
    actualPieces: record.actualPieces,
    documentPieces: record.documentPieces,
    differencePieces: record.differencePieces,
    direction: discrepancyDirection(signedDifference),
    originalWeight: balance?.originalWeight.toString() ?? null,
    settledWeight: balance?.settledWeight.toString() ?? null,
    remainingWeight: balance?.remainingWeight.toString() ?? null,
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
