import {
  BAG_STATUS_LABELS,
  BATCH_ITEM_STATUS_LABELS,
  BATCH_RECEIVING_MODE_LABELS,
  BATCH_STATUS_LABELS,
  type BagCorrectionKind,
  type BagStatus,
  type BatchItemStatus,
  type BatchReceivingMode,
  type BatchStatus,
  type RoleKey,
} from "@aitvaras/contracts";
import { formatDate, formatDateTime } from "@/shared/lib/date";

/** Empty-state text for a batch's packages. */
export const EMPTY_BAGS_MESSAGE = "Pakuočių dar nėra.";

/** Empty-state text for a batch's correction history. */
export const EMPTY_CORRECTIONS_MESSAGE = "Pataisymų dar nėra.";

/**
 * Roles that perform the **physical** receiving step (create a batch, register
 * bags). Formal documentary reconciliation is a separate ADMIN-only capability.
 */
export const RECEIVING_ROLES: RoleKey[] = ["ADMIN", "WAREHOUSE_WORKER"];

/**
 * The warehouse workplace action (label + route), shared by the home page and
 * the receiving flow. The single user-facing entry point is `Naujas priėmimas`.
 */
export const RECEIVE_ACTION = {
  label: "Naujas priėmimas",
  href: "/receiving/new",
} as const;

/**
 * The received-batch list destination (`Priėmimas`). It lists the physical
 * batches created through the receiving workflow for review and formal
 * documentary reconciliation.
 */
export const GAVIMAI_ACTION = {
  label: "Priėmimas",
  href: "/receipts",
} as const;

/** Whether the user may use the physical warehouse receiving flow. */
export function canReceiveStock(roles: readonly RoleKey[]): boolean {
  return RECEIVING_ROLES.some((role) => roles.includes(role));
}

/** Lithuanian UI label for a batch status (never the raw key). */
export function batchStatusLabel(status: BatchStatus): string {
  return BATCH_STATUS_LABELS[status];
}

/** Lithuanian UI label for a batch receiving mode (`Svorinė`/`Vienetinė`). */
export function batchReceivingModeLabel(mode: BatchReceivingMode): string {
  return BATCH_RECEIVING_MODE_LABELS[mode];
}

/** Lithuanian UI label for a PIECE item-line status (never the raw key). */
export function batchItemStatusLabel(status: BatchItemStatus): string {
  return BATCH_ITEM_STATUS_LABELS[status];
}

const BATCH_ITEM_STATUS_CLASS: Record<BatchItemStatus, string> = {
  ACTIVE: "text-muted-foreground",
  VOIDED: "text-destructive",
};

/** Restrained semantic colour for a PIECE item-line status (text only). */
export function batchItemStatusClass(status: BatchItemStatus): string {
  return BATCH_ITEM_STATUS_CLASS[status];
}

/** Empty-state text for a PIECE batch with no item lines. */
export const EMPTY_BATCH_ITEMS_MESSAGE = "Vienetų dar nėra.";

/** Whether an active (not voided) bag/item label may be printed. */
export function canPrintLabel(status: BagStatus | BatchItemStatus): boolean {
  return status === "ACTIVE";
}

/** Display-only piece count (`120 vnt.`) with Lithuanian grouping. */
export function formatPieces(count: number): string {
  return `${new Intl.NumberFormat("lt-LT").format(count)} vnt.`;
}

/** Display-only **signed** piece difference (`+5 vnt.` / `−5 vnt.`; zero bare). */
export function formatSignedPieces(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "\u2212" : "";
  return `${sign}${new Intl.NumberFormat("lt-LT").format(Math.abs(value))} vnt.`;
}

/** Lithuanian UI label for a handling unit's status (never the raw key). */
export function bagStatusLabel(status: BagStatus): string {
  return BAG_STATUS_LABELS[status];
}

const BAG_STATUS_CLASS: Record<BagStatus, string> = {
  ACTIVE: "text-muted-foreground",
  VOIDED: "text-destructive",
};

/** Restrained semantic colour for a handling unit's status (text only). */
export function bagStatusClass(status: BagStatus): string {
  return BAG_STATUS_CLASS[status];
}

const CORRECTION_KIND_LABELS: Record<BagCorrectionKind, string> = {
  PACKAGING: "Taros pataisymas",
  GROSS_WEIGHT: "Bruto svorio pataisymas",
  LOCATION: "Vietos pataisymas",
  VOID: "Anuliavimas",
};

/** Lithuanian UI label for a unit-correction kind (never the raw key). */
export function correctionKindLabel(kind: BagCorrectionKind): string {
  return CORRECTION_KIND_LABELS[kind];
}

/** Whether a batch has been formally confirmed (terminal: no re-confirmation). */
export function isBatchConfirmed(status: BatchStatus): boolean {
  return status === "CONFIRMED";
}

/**
 * Display-only signed reconciliation difference (`measuredWeight − documentWeight`)
 * as a weight string, or null when there is no documentary weight yet. Positive
 * means physically received more than documented. Follows the weight precision;
 * a non-zero result is a discrepancy.
 */
export function formatWeightDifference(
  measuredWeight: string,
  documentWeight: string | null,
): string | null {
  if (documentWeight === null || documentWeight.trim() === "") {
    return null;
  }
  const difference = Number(measuredWeight) - Number(documentWeight);
  if (!Number.isFinite(difference)) {
    return null;
  }
  return formatSignedWeight(difference);
}

/**
 * Whether the documentary and measured weights match exactly (the clean
 * confirmation rule; no tolerance is applied).
 */
export function weightsMatch(
  documentWeight: string | null,
  measuredWeight: string,
): boolean {
  if (documentWeight === null || documentWeight.trim() === "") {
    return false;
  }
  return Number(documentWeight) === Number(measuredWeight);
}

/**
 * Display-only weight formatting of a stored decimal string ("1234.5" ->
 * "1 234,500 kg"). Persistence stays decimal; this is a read-only convenience.
 */
export function formatWeight(value: number | string): string {
  const amount = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(amount)) {
    return "";
  }
  const formatted = new Intl.NumberFormat("lt-LT", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(amount);
  return `${formatted} kg`;
}

/**
 * Display-only **signed** weight (`+1 234,500 kg` / `−1 234,500 kg`), used for
 * reconciliation differences so "received more" is explicit. Zero is unsigned.
 */
export function formatSignedWeight(value: number | string): string {
  const amount = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(amount)) {
    return "";
  }
  const formatted = formatWeight(amount);
  return amount > 0 ? `+${formatted}` : formatted;
}

/** Display-only date for a batch arrival date (`yyyy-mm-dd`). */
export function formatArrivalDate(iso: string): string {
  return formatDate(iso);
}

/** Display-only timestamp with a `yyyy-mm-dd HH:mm` date portion. */
export function formatBatchDateTime(iso: string): string {
  return formatDateTime(iso);
}
