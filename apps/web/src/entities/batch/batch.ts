import {
  BAG_STATUS_LABELS,
  BATCH_STATUS_LABELS,
  type BagCorrectionKind,
  type BagStatus,
  type BatchStatus,
  type RoleKey,
} from "@aitvaras/contracts";
import { valueOrPlaceholder } from "@/shared/lib/format";

/** Empty-state text for the batches list. */
export const EMPTY_BATCHES_MESSAGE = "Partijų dar nėra.";

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
 * Whether a batch still accepts package changes (while not yet confirmed). A
 * documentary/physical mismatch does not keep a batch open: it is confirmed and
 * recorded as a separate discrepancy, so only `PENDING` accepts changes.
 */
export function isBatchOpen(status: BatchStatus): boolean {
  return status === "PENDING";
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
