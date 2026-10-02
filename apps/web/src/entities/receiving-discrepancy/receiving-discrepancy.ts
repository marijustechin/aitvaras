import {
  DISCREPANCY_DIRECTION_LABELS,
  DISCREPANCY_SETTLEMENT_TYPE_LABELS,
  RECEIVING_DISCREPANCY_STATUS_LABELS,
  type DiscrepancyDirection,
  type DiscrepancySettlementType,
  type ReceivingDiscrepancyStatus,
} from "@aitvaras/contracts";
import { formatSignedWeight, formatWeight } from "@/entities/batch";
import { valueOrPlaceholder } from "@/shared/lib/format";

/** Empty-state text for the discrepancy register. */
export const EMPTY_DISCREPANCIES_MESSAGE = "Neatitikimų nėra.";

/** Empty-state text for a discrepancy with no settlement entries. */
export const EMPTY_SETTLEMENTS_MESSAGE = "Padengimų dar nėra.";

/** Lithuanian UI label for a discrepancy status (never the raw key). */
export function discrepancyStatusLabel(status: ReceivingDiscrepancyStatus): string {
  return RECEIVING_DISCREPANCY_STATUS_LABELS[status];
}

/** Lithuanian UI label for a discrepancy direction (never the raw key). */
export function discrepancyDirectionLabel(direction: DiscrepancyDirection): string {
  return DISCREPANCY_DIRECTION_LABELS[direction];
}

/** Lithuanian UI label for a settlement type (never the raw key). */
export function settlementTypeLabel(type: DiscrepancySettlementType): string {
  return DISCREPANCY_SETTLEMENT_TYPE_LABELS[type];
}

const STATUS_CLASS: Record<ReceivingDiscrepancyStatus, string> = {
  OPEN: "text-destructive",
  PARTIALLY_SETTLED: "text-amber-600",
  SETTLED: "text-emerald-600",
};

/** Restrained semantic colour for a discrepancy status (text only). */
export function discrepancyStatusClass(status: ReceivingDiscrepancyStatus): string {
  return STATUS_CLASS[status];
}

const DIRECTION_CLASS: Record<DiscrepancyDirection, string> = {
  SHORTAGE: "text-destructive",
  OVERAGE: "text-amber-600",
};

/** Restrained semantic colour for a discrepancy direction (text only). */
export function discrepancyDirectionClass(direction: DiscrepancyDirection): string {
  return DIRECTION_CLASS[direction];
}

/** Signed difference for display, e.g. `−20,000 kg` / `+12,500 kg`. */
export const discrepancyDifferenceLabel = formatSignedWeight;

/** Positive magnitude for display, e.g. `20,000 kg`. */
export const discrepancyWeightLabel = formatWeight;

/** Settlement detail text: the empty placeholder when absent. */
export function discrepancyOptionalText(value: string | null): string {
  return valueOrPlaceholder(value);
}

/** Money amount with its currency, or the empty placeholder. */
export function settlementMoneyLabel(
  moneyAmount: string | null,
  currency: string | null,
): string {
  if (moneyAmount === null) {
    return valueOrPlaceholder(null);
  }
  return `${moneyAmount} ${currency ?? ""}`.trim();
}
