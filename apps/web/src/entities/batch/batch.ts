import { BATCH_STATUS_LABELS, type BatchStatus } from "@aitvaras/contracts";
import { valueOrPlaceholder } from "@/shared/lib/format";

/** Empty-state text for the batches list. */
export const EMPTY_BATCHES_MESSAGE = "Partijų dar nėra.";

/** Empty-state text for a batch's bags. */
export const EMPTY_BAGS_MESSAGE = "Maišų dar nėra.";

/** Lithuanian UI label for a batch status (never the raw key). */
export function batchStatusLabel(status: BatchStatus): string {
  return BATCH_STATUS_LABELS[status];
}

/** Whether a batch still accepts new bags (only while pending confirmation). */
export function isBatchOpen(status: BatchStatus): boolean {
  return status === "PENDING";
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
