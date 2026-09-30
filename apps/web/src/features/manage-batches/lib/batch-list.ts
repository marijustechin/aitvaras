import type { Batch, BatchStatus } from "@aitvaras/contracts";

/** Heading for the ADMIN received-batch queue (`Gavimai`). */
export const GAVIMAI_HEADING = "Gautos partijos";

/** The ADMIN formal confirmation action (reconciliation card heading + button). */
export const CONFIRM_RECEIPT_LABEL = "Patvirtinti gavimą";

/** Empty-state text when no batch matches the current queue filters. */
export const EMPTY_GAVIMAI_MESSAGE =
  "Gautų partijų pagal pasirinktus filtrus nėra.";

/** Action that clears every queue filter back to the default view. */
export const RESET_FILTERS_LABEL = "Atstatyti filtrus";

/**
 * Status filter of the received-batch queue. `Reikia patvirtinti` is the default
 * work queue and means `PENDING + DISCREPANCY`.
 */
export const BATCH_STATUS_FILTERS = [
  "NEEDS_CONFIRMATION",
  "PENDING",
  "DISCREPANCY",
  "CONFIRMED",
  "ALL",
] as const;
export type BatchStatusFilter = (typeof BATCH_STATUS_FILTERS)[number];

export const BATCH_STATUS_FILTER_LABELS: Record<BatchStatusFilter, string> = {
  NEEDS_CONFIRMATION: "Reikia patvirtinti",
  PENDING: "Laukiama patvirtinimo",
  DISCREPANCY: "Neatitikimas",
  CONFIRMED: "Patvirtinta",
  ALL: "Visos",
};

/** Default queue view: everything still needing confirmation. */
export const DEFAULT_BATCH_STATUS_FILTER: BatchStatusFilter =
  "NEEDS_CONFIRMATION";

const STATUSES_BY_FILTER: Record<BatchStatusFilter, BatchStatus[]> = {
  NEEDS_CONFIRMATION: ["PENDING", "DISCREPANCY"],
  PENDING: ["PENDING"],
  DISCREPANCY: ["DISCREPANCY"],
  CONFIRMED: ["CONFIRMED"],
  ALL: ["PENDING", "CONFIRMED", "DISCREPANCY"],
};

/** The batch statuses a queue filter selects. */
export function statusesForFilter(filter: BatchStatusFilter): BatchStatus[] {
  return STATUSES_BY_FILTER[filter];
}

export interface BatchListFilters {
  status: BatchStatusFilter;
  supplierId: string;
  resourceId: string;
  warehouseId: string;
  /** `yyyy-mm-dd` arrival date lower bound (inclusive), or "". */
  arrivalFrom: string;
  /** `yyyy-mm-dd` arrival date upper bound (inclusive), or "". */
  arrivalTo: string;
  /** Free-text batch-code search (case-insensitive), or "". */
  code: string;
}

export function createBatchListFilters(): BatchListFilters {
  return {
    status: DEFAULT_BATCH_STATUS_FILTER,
    supplierId: "",
    resourceId: "",
    warehouseId: "",
    arrivalFrom: "",
    arrivalTo: "",
    code: "",
  };
}

/** Whether any filter differs from the default queue view. */
export function hasActiveBatchFilters(filters: BatchListFilters): boolean {
  const defaults = createBatchListFilters();
  return (Object.keys(defaults) as (keyof BatchListFilters)[]).some(
    (key) => filters[key] !== defaults[key],
  );
}

function withinArrivalRange(iso: string, from: string, to: string): boolean {
  const date = iso.slice(0, 10);
  if (from && date < from) {
    return false;
  }
  if (to && date > to) {
    return false;
  }
  return true;
}

/**
 * Apply the queue filters client-side. The received-batch dataset is small, so
 * this avoids adding a server-side filter framework; the API still exposes
 * `?status=` for other callers.
 */
export function filterBatches(
  batches: readonly Batch[],
  filters: BatchListFilters,
): Batch[] {
  const statuses = statusesForFilter(filters.status);
  const code = filters.code.trim().toLowerCase();
  return batches.filter((batch) => {
    if (!statuses.includes(batch.status)) {
      return false;
    }
    if (filters.supplierId && batch.supplierId !== filters.supplierId) {
      return false;
    }
    if (filters.resourceId && batch.resourceId !== filters.resourceId) {
      return false;
    }
    if (filters.warehouseId && batch.warehouseId !== filters.warehouseId) {
      return false;
    }
    if (
      !withinArrivalRange(batch.arrivalDate, filters.arrivalFrom, filters.arrivalTo)
    ) {
      return false;
    }
    if (code && !batch.code.toLowerCase().includes(code)) {
      return false;
    }
    return true;
  });
}

export interface FilterOption {
  id: string;
  name: string;
}

function distinctOptions(
  batches: readonly Batch[],
  idOf: (batch: Batch) => string,
  nameOf: (batch: Batch) => string,
): FilterOption[] {
  const byId = new Map<string, string>();
  for (const batch of batches) {
    const id = idOf(batch);
    if (!byId.has(id)) {
      byId.set(id, nameOf(batch));
    }
  }
  return [...byId.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "lt"));
}

/** Filter options are derived from the loaded batches (active or historical). */
export function supplierFilterOptions(batches: readonly Batch[]): FilterOption[] {
  return distinctOptions(
    batches,
    (batch) => batch.supplierId,
    (batch) => batch.supplierName,
  );
}

export function resourceFilterOptions(batches: readonly Batch[]): FilterOption[] {
  return distinctOptions(
    batches,
    (batch) => batch.resourceId,
    (batch) => batch.resourceName,
  );
}

export function warehouseFilterOptions(batches: readonly Batch[]): FilterOption[] {
  return distinctOptions(
    batches,
    (batch) => batch.warehouseId,
    (batch) => batch.warehouseName,
  );
}

/** The ADMIN detail/reconciliation screen for a received batch. */
export function batchDetailHref(batchId: string): string {
  return `/receipts/batches/${batchId}`;
}

const STATUS_CLASS: Record<BatchStatus, string> = {
  PENDING: "text-muted-foreground",
  CONFIRMED: "text-emerald-500",
  DISCREPANCY: "text-rose-500",
};

/**
 * Restrained semantic colour for a batch status: text only, never a coloured
 * row. `PENDING` stays neutral/muted.
 */
export function batchStatusClass(status: BatchStatus): string {
  return STATUS_CLASS[status];
}
