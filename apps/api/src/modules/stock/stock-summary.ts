import { Prisma } from "@aitvaras/database";
import type { StockSummary } from "@aitvaras/contracts";

/** One confirmed batch's contribution to the cost side of the summary. */
export interface ConfirmedBatchStockRow {
  receivingMode: "WEIGHT" | "PIECE";
  acquisitionAmount: Prisma.Decimal | null;
  /** Frozen receipt-expense shares; absent/legacy batches have none. */
  allocatedTransportAmount?: Prisma.Decimal | null;
  allocatedCustomsAmount?: Prisma.Decimal | null;
  activeBagCount: number;
  activeItemCount: number;
}

interface CardState {
  value: Prisma.Decimal;
  known: boolean;
  incomplete: boolean;
}

function addCost(
  state: CardState,
  acquisitionAmount: Prisma.Decimal | null,
  allocatedTransportAmount: Prisma.Decimal | null,
  allocatedCustomsAmount: Prisma.Decimal | null,
): void {
  const expenses = (allocatedTransportAmount ?? new Prisma.Decimal(0)).plus(
    allocatedCustomsAmount ?? new Prisma.Decimal(0),
  );
  if (acquisitionAmount === null) {
    state.incomplete = true;
  }
  if (acquisitionAmount !== null || !expenses.isZero()) {
    state.value = state.value
      .plus(acquisitionAmount ?? new Prisma.Decimal(0))
      .plus(expenses);
    state.known = true;
  }
}

function cardValue(quantityPresent: boolean, state: CardState): {
  value: string | null;
  valuationIncomplete: boolean;
} {
  if (!quantityPresent) {
    // No eligible stock is a real zero, not an unknown valuation.
    return { value: "0", valuationIncomplete: false };
  }
  return {
    value: state.known ? state.value.toString() : null,
    // Defensive: a positive quantity without a cost row is still incomplete.
    valuationIncomplete: state.incomplete || !state.known,
  };
}

/**
 * Pure summary calculation used by the API and unit tests.
 *
 * Costs are added **once per confirmed batch**, never per bag/item line, so
 * multiple packages/lines cannot duplicate the acquisition value. Quantity totals
 * come from active units only. The current model has no stock-movement table, so
 * confirmed active units are the remaining stock; if movements are introduced,
 * they must reduce these quantities before valuation is applied.
 */
export function summarizeStock(input: {
  weightKg: Prisma.Decimal | null;
  pieces: number | null;
  batches: readonly ConfirmedBatchStockRow[];
}): StockSummary {
  const weightQuantity = input.weightKg ?? new Prisma.Decimal(0);
  const piecesQuantity = input.pieces ?? 0;

  const weight: CardState = {
    value: new Prisma.Decimal(0),
    known: false,
    incomplete: false,
  };
  const pieces: CardState = {
    value: new Prisma.Decimal(0),
    known: false,
    incomplete: false,
  };

  for (const batch of input.batches) {
    if (batch.receivingMode === "WEIGHT" && batch.activeBagCount > 0) {
      addCost(
        weight,
        batch.acquisitionAmount,
        batch.allocatedTransportAmount ?? null,
        batch.allocatedCustomsAmount ?? null,
      );
    }
    if (batch.receivingMode === "PIECE" && batch.activeItemCount > 0) {
      addCost(
        pieces,
        batch.acquisitionAmount,
        batch.allocatedTransportAmount ?? null,
        batch.allocatedCustomsAmount ?? null,
      );
    }
  }

  const weightCard = cardValue(!weightQuantity.isZero(), weight);
  const piecesCard = cardValue(piecesQuantity > 0, pieces);

  return {
    weight: {
      quantityKg: weightQuantity.toString(),
      value: weightCard.value,
      valuationIncomplete: weightCard.valuationIncomplete,
    },
    pieces: {
      quantity: piecesQuantity,
      value: piecesCard.value,
      valuationIncomplete: piecesCard.valuationIncomplete,
    },
  };
}
