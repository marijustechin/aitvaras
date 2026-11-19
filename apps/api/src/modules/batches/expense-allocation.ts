import { Prisma } from "@aitvaras/database";
import type { DeliveryExpenseAllocationMethod } from "@aitvaras/contracts";

/** One batch's actual quantity/acquisition, used as an allocation denominator. */
export interface ExpenseAllocationBatch {
  id: string;
  code: string;
  receivingMode: "WEIGHT" | "PIECE";
  quantity: Prisma.Decimal;
  /** Recorded acquisition value; null when unknown. */
  acquisitionAmount: Prisma.Decimal | null;
}

export interface ExpenseShare {
  transport: Prisma.Decimal;
  customs: Prisma.Decimal;
}

export type AllocationBasis = "NET_WEIGHT" | "PIECES" | "ACQUISITION";

export interface ProportionalEligibility {
  basis: AllocationBasis;
  available: boolean;
  blockedReason: string | null;
}

/** A mixed receipt has at least one missing acquisition value. */
export class MissingAcquisitionValueError extends Error {
  constructor(public readonly batchCodes: string[]) {
    super(
      `Trūksta įsigijimo vertės: ${batchCodes.join(", ")}.`,
    );
  }
}

/** A mixed receipt's recorded acquisition values sum to zero. */
export class ZeroAcquisitionBasisError extends Error {
  constructor() {
    super(
      "Įsigijimo verčių suma lygi 0, todėl proporcinis paskirstymas negalimas.",
    );
  }
}

/** Whether the receipt has both WEIGHT and PIECE batches with actual quantity. */
export function isMixedReceipt(
  batches: readonly Pick<ExpenseAllocationBatch, "receivingMode" | "quantity">[],
): boolean {
  return new Set(
    batches
      .filter((batch) => batch.quantity.gt(0))
      .map((batch) => batch.receivingMode),
  ).size > 1;
}

/** Stable eligible order: positive quantities, sorted by batch code then id. */
function eligible(
  batches: readonly ExpenseAllocationBatch[],
): ExpenseAllocationBatch[] {
  return batches
    .filter((batch) => batch.quantity.gt(0))
    .sort((left, right) =>
      left.code === right.code
        ? left.id.localeCompare(right.id)
        : left.code.localeCompare(right.code, "lt"),
    );
}

/** The proportional basis selected from the eligible batches. */
export function allocationBasis(
  batches: readonly ExpenseAllocationBatch[],
): AllocationBasis {
  const rows = eligible(batches);
  if (isMixedReceipt(rows)) {
    return "ACQUISITION";
  }
  return rows[0]?.receivingMode === "PIECE" ? "PIECES" : "NET_WEIGHT";
}

/** Whether `Pagal vertę` is currently usable and why not. */
export function proportionalEligibility(
  batches: readonly ExpenseAllocationBatch[],
): ProportionalEligibility {
  const rows = eligible(batches);
  const basis = allocationBasis(rows);
  if (basis !== "ACQUISITION") {
    return { basis, available: true, blockedReason: null };
  }
  const missing = rows
    .filter((batch) => batch.acquisitionAmount === null)
    .map((batch) => batch.code);
  if (missing.length > 0) {
    return {
      basis,
      available: false,
      blockedReason: `Trūksta įsigijimo vertės: ${missing.join(", ")}.`,
    };
  }
  const sum = rows.reduce(
    (total, batch) => total.plus(batch.acquisitionAmount ?? 0),
    new Prisma.Decimal(0),
  );
  if (sum.isZero()) {
    return {
      basis,
      available: false,
      blockedReason:
        "Įsigijimo verčių suma lygi 0, todėl proporcinis paskirstymas negalimas.",
    };
  }
  return { basis, available: true, blockedReason: null };
}

function centsOf(amount: Prisma.Decimal): number {
  return amount
    .times(100)
    .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
    .toNumber();
}

function decimalOfCents(cents: number): Prisma.Decimal {
  return new Prisma.Decimal(cents).div(100);
}

/** Split integer cents, assigning remainder cents deterministically. */
function equalCents(totalCents: number, count: number): number[] {
  if (count === 0) {
    return [];
  }
  const base = Math.floor(totalCents / count);
  let remainder = totalCents - base * count;
  return Array.from({ length: count }, () => {
    const cents = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) {
      remainder -= 1;
    }
    return cents;
  });
}

/** Split integer cents proportionally by arbitrary non-negative weights. */
function proportionalCents(
  totalCents: number,
  weights: readonly Prisma.Decimal[],
): number[] {
  const denominator = weights.reduce(
    (sum, weight) => sum.plus(weight),
    new Prisma.Decimal(0),
  );
  if (denominator.isZero()) {
    return weights.map(() => 0);
  }
  const rows = weights.map((weight, index) => {
    const raw = new Prisma.Decimal(totalCents).times(weight).div(denominator);
    const floor = raw.floor();
    return {
      index,
      cents: floor.toNumber(),
      fraction: raw.minus(floor),
    };
  });
  let remainder =
    totalCents - rows.reduce((sum, row) => sum + row.cents, 0);
  const byRemainder = [...rows].sort(
    (left, right) =>
      right.fraction.comparedTo(left.fraction) || left.index - right.index,
  );
  for (const row of byRemainder) {
    if (remainder <= 0) {
      break;
    }
    row.cents += 1;
    remainder -= 1;
  }
  return rows.map((row) => row.cents);
}

/**
 * Allocate transport and customs separately to the cent.
 *
 * `BY_VALUE` uses actual net kg for an all-WEIGHT receipt, actual pieces for an
 * all-PIECE receipt, or each batch's recorded acquisition value for a mixed
 * receipt. A mixed receipt needs every eligible batch to have a recorded value
 * and a positive total; zero is a valid zero share, missing is unknown.
 */
export function allocateExpenses(
  batches: readonly ExpenseAllocationBatch[],
  method: DeliveryExpenseAllocationMethod,
  transportAmount: Prisma.Decimal,
  customsAmount: Prisma.Decimal,
): Map<string, ExpenseShare> {
  const rows = eligible(batches);
  if (rows.length === 0) {
    return new Map();
  }

  if (method === "EQUAL") {
    const transportCents = equalCents(centsOf(transportAmount), rows.length);
    const customsCents = equalCents(centsOf(customsAmount), rows.length);
    return new Map(
      rows.map((batch, index) => [
        batch.id,
        {
          transport: decimalOfCents(transportCents[index] ?? 0),
          customs: decimalOfCents(customsCents[index] ?? 0),
        },
      ]),
    );
  }

  const basis = allocationBasis(rows);
  let weights: Prisma.Decimal[];
  if (basis === "ACQUISITION") {
    const missing = rows
      .filter((batch) => batch.acquisitionAmount === null)
      .map((batch) => batch.code);
    if (missing.length > 0) {
      throw new MissingAcquisitionValueError(missing);
    }
    weights = rows.map(
      (batch) => batch.acquisitionAmount ?? new Prisma.Decimal(0),
    );
    const total = weights.reduce(
      (sum, weight) => sum.plus(weight),
      new Prisma.Decimal(0),
    );
    if (total.isZero()) {
      throw new ZeroAcquisitionBasisError();
    }
  } else {
    weights = rows.map((batch) => batch.quantity);
  }

  const transportCents = proportionalCents(centsOf(transportAmount), weights);
  const customsCents = proportionalCents(centsOf(customsAmount), weights);
  return new Map(
    rows.map((batch, index) => [
      batch.id,
      {
        transport: decimalOfCents(transportCents[index] ?? 0),
        customs: decimalOfCents(customsCents[index] ?? 0),
      },
    ]),
  );
}
