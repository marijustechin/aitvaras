import type {
  DiscrepancyDirection,
  ReceivingDiscrepancyRegisterRow,
  ReceivingDiscrepancyStatus,
} from "@aitvaras/contracts";

/** Heading of the ADMIN discrepancy register. */
export const DISCREPANCIES_HEADING = "Neatitikimai";

/** Filter reset action label. */
export const RESET_FILTERS_LABEL = "Atstatyti filtrus";

export type DiscrepancyStatusFilter =
  | "OPEN"
  | "PARTIALLY_SETTLED"
  | "SETTLED"
  | "ALL";

export const DISCREPANCY_STATUS_FILTERS: readonly DiscrepancyStatusFilter[] = [
  "OPEN",
  "PARTIALLY_SETTLED",
  "SETTLED",
  "ALL",
];

export const DISCREPANCY_STATUS_FILTER_LABELS: Record<
  DiscrepancyStatusFilter,
  string
> = {
  OPEN: "Atviri",
  PARTIALLY_SETTLED: "Dalinai padengti",
  SETTLED: "Padengti",
  ALL: "Visi",
};

/** Default register view: only not-yet-settled discrepancies. */
export const DEFAULT_DISCREPANCY_STATUS_FILTER: DiscrepancyStatusFilter = "OPEN";

export type DiscrepancyDirectionFilter = DiscrepancyDirection | "ALL";

export const DISCREPANCY_DIRECTION_FILTERS: readonly DiscrepancyDirectionFilter[] =
  ["ALL", "SHORTAGE", "OVERAGE"];

export const DISCREPANCY_DIRECTION_FILTER_LABELS: Record<
  DiscrepancyDirectionFilter,
  string
> = {
  ALL: "Visi",
  SHORTAGE: "Trūkumas",
  OVERAGE: "Perteklius",
};

export interface DiscrepancyListFilters {
  status: DiscrepancyStatusFilter;
  supplierId: string;
  resourceId: string;
  direction: DiscrepancyDirectionFilter;
  dateFrom: string;
  dateTo: string;
  code: string;
}

/**
 * Default filters. The status defaults to `Atviri` and the date range is
 * deliberately **empty** — old unresolved discrepancies must stay visible until
 * settled, so no default date bound is imposed.
 */
export function createDiscrepancyListFilters(): DiscrepancyListFilters {
  return {
    status: DEFAULT_DISCREPANCY_STATUS_FILTER,
    supplierId: "",
    resourceId: "",
    direction: "ALL",
    dateFrom: "",
    dateTo: "",
    code: "",
  };
}

/** The discrepancy statuses a status filter selects (`ALL` = every status). */
export function statusesForDiscrepancyFilter(
  filter: DiscrepancyStatusFilter,
): ReceivingDiscrepancyStatus[] {
  return filter === "ALL"
    ? ["OPEN", "PARTIALLY_SETTLED", "SETTLED"]
    : [filter];
}

/** Whether any filter differs from the default register view. */
export function hasActiveDiscrepancyFilters(
  filters: DiscrepancyListFilters,
): boolean {
  const defaults = createDiscrepancyListFilters();
  return (Object.keys(defaults) as (keyof DiscrepancyListFilters)[]).some(
    (key) => filters[key] !== defaults[key],
  );
}

/** The register date used for the date-range filter (the discrepancy date). */
export function discrepancyDate(row: ReceivingDiscrepancyRegisterRow): string {
  return row.createdAt.slice(0, 10);
}

/** Client-side register filtering (status/supplier/resource/direction/date/code). */
export function filterDiscrepancies(
  rows: ReceivingDiscrepancyRegisterRow[],
  filters: DiscrepancyListFilters,
): ReceivingDiscrepancyRegisterRow[] {
  const statuses = statusesForDiscrepancyFilter(filters.status);
  const code = filters.code.trim().toLowerCase();
  return rows.filter((row) => {
    if (!statuses.includes(row.status)) {
      return false;
    }
    if (filters.supplierId && row.supplierId !== filters.supplierId) {
      return false;
    }
    if (filters.resourceId && row.resourceId !== filters.resourceId) {
      return false;
    }
    if (filters.direction !== "ALL" && row.direction !== filters.direction) {
      return false;
    }
    const date = discrepancyDate(row);
    if (filters.dateFrom && date < filters.dateFrom) {
      return false;
    }
    if (filters.dateTo && date > filters.dateTo) {
      return false;
    }
    if (code && !row.deliveryCode.toLowerCase().includes(code)) {
      return false;
    }
    return true;
  });
}

export interface DiscrepancyFilterOption {
  id: string;
  name: string;
}

function distinctOptions(
  rows: ReceivingDiscrepancyRegisterRow[],
  idOf: (row: ReceivingDiscrepancyRegisterRow) => string,
  nameOf: (row: ReceivingDiscrepancyRegisterRow) => string,
): DiscrepancyFilterOption[] {
  const byId = new Map<string, string>();
  for (const row of rows) {
    const id = idOf(row);
    if (!byId.has(id)) {
      byId.set(id, nameOf(row));
    }
  }
  return [...byId.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "lt"));
}

export function supplierFilterOptions(
  rows: ReceivingDiscrepancyRegisterRow[],
): DiscrepancyFilterOption[] {
  return distinctOptions(
    rows,
    (row) => row.supplierId,
    (row) => row.supplierName,
  );
}

export function resourceFilterOptions(
  rows: ReceivingDiscrepancyRegisterRow[],
): DiscrepancyFilterOption[] {
  return distinctOptions(
    rows,
    (row) => row.resourceId,
    (row) => row.resourceName,
  );
}

/** Link to a discrepancy's detail screen. */
export function discrepancyDetailHref(id: string): string {
  return `/reports/discrepancies/${id}`;
}

/** The register route. */
export const DISCREPANCIES_HREF = "/reports/discrepancies";
