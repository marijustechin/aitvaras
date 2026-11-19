import type { Batch, BatchStatus, IncomingDelivery } from "@aitvaras/contracts";
import { isoDatePart } from "@/shared/lib/date";

/** Heading for the receipt list (`Priėmimas`). */
export const GAVIMAI_HEADING = "Priėmimai";

/** The ADMIN formal confirmation action (reconciliation card heading + button). */
export const CONFIRM_RECEIPT_LABEL = "Patvirtinti priėmimą";

/** Empty-state text when no receipt matches the current queue filters. */
export const EMPTY_GAVIMAI_MESSAGE =
  "Priėmimų pagal pasirinktus filtrus nėra.";

/** Action that clears every queue filter back to the default view. */
export const RESET_FILTERS_LABEL = "Atstatyti filtrus";

/** Status shown for a receipt that has no batches yet. */
export const NO_BATCHES_STATUS_LABEL = "Be partijų";

/** Action that deletes an eligible batch-less receipt. */
export const DELETE_RECEIPT_LABEL = "Ištrinti priėmimą";

/** Cancel action in the receipt-deletion confirmation dialog. */
export const DELETE_RECEIPT_CANCEL_LABEL = "Atšaukti";

/** Confirm action in the receipt-deletion dialog. */
export const DELETE_RECEIPT_CONFIRM_LABEL = "Ištrinti";

/** Explanation shown when a receipt's recorded expenses block deletion. */
export const EMPTY_RECEIPT_EXPENSE_BLOCK_MESSAGE =
  "Negalima ištrinti: užregistruota transporto arba muitinės išlaidų.";

/**
 * Status filter of the receipt list. `Laukia patvirtinimo` is the default work
 * queue and means receipts with at least one not-yet-confirmed `PENDING` batch
 * (including partially confirmed receipts). `Patvirtinta` means all batches are
 * confirmed; `Visos` also includes zero-batch receipts.
 */
export const BATCH_STATUS_FILTERS = [
  "PENDING",
  "CONFIRMED",
  "ALL",
] as const;
export type BatchStatusFilter = (typeof BATCH_STATUS_FILTERS)[number];

export const BATCH_STATUS_FILTER_LABELS: Record<BatchStatusFilter, string> = {
  PENDING: "Laukia patvirtinimo",
  CONFIRMED: "Patvirtinta",
  ALL: "Visos",
};

/** Default queue view: receipts with at least one pending batch. */
export const DEFAULT_BATCH_STATUS_FILTER: BatchStatusFilter = "PENDING";

const STATUSES_BY_FILTER: Record<BatchStatusFilter, BatchStatus[]> = {
  PENDING: ["PENDING"],
  CONFIRMED: ["CONFIRMED"],
  ALL: ["PENDING", "CONFIRMED"],
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

/** Session key for restoring the list view after visiting a batch detail/edit. */
export const BATCH_LIST_FILTERS_STORAGE_KEY =
  "aitvaras.priemimas.filters.v1";

/** Parse persisted filters defensively; malformed values fall back to defaults. */
export function parseBatchListFilters(raw: string | null): BatchListFilters {
  const defaults = createBatchListFilters();
  if (!raw) {
    return defaults;
  }
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const rawStatus = value.status as string;
    const status: BatchStatusFilter =
      rawStatus === "NEEDS_CONFIRMATION"
        ? "PENDING"
        : BATCH_STATUS_FILTERS.includes(rawStatus as BatchStatusFilter)
          ? (rawStatus as BatchStatusFilter)
          : defaults.status;
    const text = (key: keyof BatchListFilters): string =>
      typeof value[key] === "string"
        ? (value[key] as string)
        : (defaults[key] as string);
    return {
      status,
      supplierId: text("supplierId"),
      resourceId: text("resourceId"),
      warehouseId: text("warehouseId"),
      arrivalFrom: text("arrivalFrom"),
      arrivalTo: text("arrivalTo"),
      code: text("code"),
    };
  } catch {
    return defaults;
  }
}

/** Whether any filter differs from the default queue view. */
export function hasActiveBatchFilters(filters: BatchListFilters): boolean {
  const defaults = createBatchListFilters();
  return (Object.keys(defaults) as (keyof BatchListFilters)[]).some(
    (key) => filters[key] !== defaults[key],
  );
}

function withinArrivalRange(iso: string, from: string, to: string): boolean {
  const date = isoDatePart(iso);
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

/** Receipt-level status shown in the `Priėmimai` list. */
export type ReceiptStatus = "NO_BATCHES" | "PENDING" | "CONFIRMED";

export const RECEIPT_STATUS_LABELS: Record<ReceiptStatus, string> = {
  NO_BATCHES: "Be partijų",
  PENDING: "Laukia patvirtinimo",
  CONFIRMED: "Patvirtintas",
};

/** One receipt, with all of its batches regardless of the active filter. */
export interface ReceiptRow {
  delivery: IncomingDelivery;
  batches: Batch[];
  confirmedBatchCount: number;
  status: ReceiptStatus;
}

export function receiptStatusLabel(status: ReceiptStatus): string {
  return RECEIPT_STATUS_LABELS[status];
}

export function receiptStatusClass(status: ReceiptStatus): string {
  if (status === "CONFIRMED") {
    return "text-emerald-500";
  }
  return "text-muted-foreground";
}

/** `—` for an empty receipt, otherwise `confirmed iš total`. */
export function confirmedBatchesLabel(row: ReceiptRow): string {
  if (row.batches.length === 0) {
    return "—";
  }
  return `${row.confirmedBatchCount} iš ${row.batches.length}`;
}

function matchesBatchSpecificFilters(
  batch: Batch,
  filters: BatchListFilters,
): boolean {
  if (filters.resourceId && batch.resourceId !== filters.resourceId) {
    return false;
  }
  if (filters.warehouseId && batch.warehouseId !== filters.warehouseId) {
    return false;
  }
  const code = filters.code.trim().toLowerCase();
  if (code && !batch.code.toLowerCase().includes(code)) {
    return false;
  }
  return true;
}

/**
 * Group the batch rows by receipt and apply the receipt-level filters.
 *
 * `Laukia patvirtinimo` means “at least one pending batch”; `Patvirtinta` means
 * every batch is confirmed; `Visos` also includes zero-batch receipts. Resource/warehouse/batch-code filters match a receipt
 * once when any of its batches matches all supplied batch-specific filters.
 */
export function receiptRows(
  batches: readonly Batch[],
  deliveries: readonly IncomingDelivery[],
  filters: BatchListFilters,
): ReceiptRow[] {
  const byDelivery = new Map<string, Batch[]>();
  for (const batch of batches) {
    const group = byDelivery.get(batch.deliveryId);
    if (group) {
      group.push(batch);
    } else {
      byDelivery.set(batch.deliveryId, [batch]);
    }
  }
  const hasBatchSpecificFilters = Boolean(
    filters.resourceId || filters.warehouseId || filters.code.trim(),
  );
  const rows: ReceiptRow[] = [];
  for (const delivery of deliveries) {
    const receiptBatches = byDelivery.get(delivery.id) ?? [];
    const confirmedBatchCount = receiptBatches.filter(
      (batch) => batch.status === "CONFIRMED",
    ).length;
    const status: ReceiptStatus =
      receiptBatches.length === 0
        ? "NO_BATCHES"
        : confirmedBatchCount === receiptBatches.length
          ? "CONFIRMED"
          : "PENDING";

    if (filters.status === "ALL") {
      // keep every status
    } else if (filters.status === "CONFIRMED") {
      if (status !== "CONFIRMED") continue;
    } else if (status !== "PENDING") {
      continue;
    }

    if (filters.supplierId && delivery.supplierId !== filters.supplierId) {
      continue;
    }
    if (
      !withinArrivalRange(
        delivery.arrivalDate,
        filters.arrivalFrom,
        filters.arrivalTo,
      )
    ) {
      continue;
    }
    if (hasBatchSpecificFilters) {
      if (receiptBatches.length === 0) {
        continue;
      }
      if (
        !receiptBatches.some((batch) =>
          matchesBatchSpecificFilters(batch, filters),
        )
      ) {
        continue;
      }
    }
    rows.push({ delivery, batches: receiptBatches, confirmedBatchCount, status });
  }
  return rows.sort(
    (left, right) =>
      right.delivery.createdAt.localeCompare(left.delivery.createdAt) ||
      right.delivery.id.localeCompare(left.delivery.id),
  );
}

/** Page size for the receipt list. Pagination runs after grouping. */
export const RECEIPT_PAGE_SIZE = 20;

export interface ReceiptPage {
  rows: ReceiptRow[];
  page: number;
  totalPages: number;
  total: number;
  from: number;
  to: number;
}

/** Slice already-grouped receipt rows into a page. */
export function paginateReceiptRows(
  rows: readonly ReceiptRow[],
  page: number,
  pageSize: number = RECEIPT_PAGE_SIZE,
): ReceiptPage {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);
  return {
    rows: pageRows,
    page: safePage,
    totalPages,
    total,
    from: total === 0 ? 0 : start + 1,
    to: start + pageRows.length,
  };
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

/**
 * Supplier options including suppliers that only have batch-less receipts (they
 * have no batch row, so the batch-derived options would omit them).
 */
export function supplierFilterOptionsWithReceipts(
  batches: readonly Batch[],
  deliveries: readonly IncomingDelivery[],
): FilterOption[] {
  const byId = new Map<string, string>();
  for (const option of supplierFilterOptions(batches)) {
    byId.set(option.id, option.name);
  }
  for (const delivery of deliveries) {
    if (delivery.batchCount === 0 && !byId.has(delivery.supplierId)) {
      byId.set(delivery.supplierId, delivery.supplierName);
    }
  }
  return [...byId.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "lt"));
}

export function resourceFilterOptions(batches: readonly Batch[]): FilterOption[] {
  // PIECE batches have no batch-level resource; skip them from the options.
  return distinctOptions(
    batches,
    (batch) => batch.resourceId ?? "",
    (batch) => batch.resourceName ?? "",
  ).filter((option) => option.id !== "");
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
};

/**
 * Restrained semantic colour for a batch status: text only, never a coloured
 * row. `PENDING` stays neutral/muted.
 */
export function batchStatusClass(status: BatchStatus): string {
  return STATUS_CLASS[status];
}
