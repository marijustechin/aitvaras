import {
  BAG_STATUS_LABELS,
  BATCH_STATUS_LABELS,
  HANDLING_UNIT_LABELS,
  type BagCorrectionKind,
  type BagStatus,
  type BatchStatus,
  type HandlingUnitKey,
  type RoleKey,
} from "@aitvaras/contracts";
import { valueOrPlaceholder } from "@/shared/lib/format";

/** Empty-state text for the batches list. */
export const EMPTY_BATCHES_MESSAGE = "Partijų dar nėra.";

/** Empty-state text for a batch's bags. */
export const EMPTY_BAGS_MESSAGE = "Maišų dar nėra.";

/** Empty-state text for a batch's correction history. */
export const EMPTY_CORRECTIONS_MESSAGE = "Pataisymų dar nėra.";

/**
 * Roles that perform the **physical** receiving step (create a batch, register
 * bags). Formal documentary reconciliation is a separate ADMIN-only capability.
 */
export const RECEIVING_ROLES: RoleKey[] = ["ADMIN", "WAREHOUSE_WORKER"];

/**
 * The warehouse workplace action (label + route), shared by the home page,
 * navigation and the receiving flow. Uses the familiar operational term
 * `Registruoti sandėlyje` (not the formal `Pajamavimas`).
 */
export const RECEIVE_ACTION = {
  label: "Registruoti sandėlyje",
  href: "/receiving",
} as const;

/**
 * The ADMIN received-batch queue (formerly labelled `Pajamavimas`). It lists the
 * physical batches created through `Registruoti sandėlyje` for review and formal
 * documentary reconciliation.
 */
export const GAVIMAI_ACTION = {
  label: "Gavimai",
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

/**
 * Whether a batch still accepts bag changes (while not yet confirmed): a
 * `PENDING` batch accepts new units and a `DISCREPANCY` batch accepts the
 * physical corrections that resolve it. A `CONFIRMED` batch is frozen.
 */
export function isBatchOpen(status: BatchStatus): boolean {
  return status === "PENDING" || status === "DISCREPANCY";
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
  QUANTITY: "Kiekio pataisymas",
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
 * Display-only reconciliation difference (`documentWeight − measuredWeight`) as a
 * weight string, or null when the batch has no documentary weight yet. Follows
 * the same precision as other weights; a non-zero result means the documentary
 * and measured quantities differ (a discrepancy).
 */
export function formatWeightDifference(
  documentWeight: string | null,
  measuredWeight: string,
): string | null {
  if (documentWeight === null || documentWeight.trim() === "") {
    return null;
  }
  const difference = Number(documentWeight) - Number(measuredWeight);
  if (!Number.isFinite(difference)) {
    return null;
  }
  return formatWeight(difference);
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

/** Lithuanian short label for a handling unit's measurement unit. */
export function handlingUnitLabel(unit: HandlingUnitKey): string {
  return HANDLING_UNIT_LABELS[unit];
}

/**
 * Display-only quantity formatting: `KG` uses the 3-decimal weight convention
 * ("48.725" -> "48,725 kg"); `PCS` is whole units ("12" -> "12 vnt").
 */
export function formatQuantity(
  value: number | string,
  unit: HandlingUnitKey,
): string {
  const amount = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(amount)) {
    return "";
  }
  const formatted = new Intl.NumberFormat(
    "lt-LT",
    unit === "PCS"
      ? { maximumFractionDigits: 0 }
      : { minimumFractionDigits: 3, maximumFractionDigits: 3 },
  ).format(amount);
  return `${formatted} ${HANDLING_UNIT_LABELS[unit]}`;
}

/** Display-only date for a batch arrival date. */
export function formatArrivalDate(iso: string): string {
  return new Intl.DateTimeFormat("lt-LT", { dateStyle: "medium" }).format(
    new Date(iso),
  );
}

/** Display-only short date/time for a batch or bag timestamp. */
export function formatBatchDateTime(iso: string): string {
  return new Intl.DateTimeFormat("lt-LT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

/** Bag location display: the location name, or the empty placeholder. */
export function bagLocationLabel(name: string | null): string {
  return valueOrPlaceholder(name);
}
