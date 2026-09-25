import {
  MEASUREMENT_UNIT_LABELS,
  type MeasurementUnitKey,
} from "@aitvaras/contracts";
import { valueOrPlaceholder } from "@/shared/lib/format";

/** Empty-state text for the receipts list. */
export const EMPTY_RECEIPTS_MESSAGE = "Pajamavimų dar nėra.";

/** Lithuanian shorthand label for a measurement unit (kg / vnt.). */
export function receiptUnitLabel(unit: MeasurementUnitKey): string {
  return MEASUREMENT_UNIT_LABELS[unit];
}

/**
 * Warehouse location display: the location name, or the empty placeholder when
 * no specific location was recorded (location is optional on a receipt line).
 */
export function receiptLocationLabel(name: string | null): string {
  return valueOrPlaceholder(name);
}

/**
 * Display-only EUR formatting of a decimal string/number.
 *
 * Persistence remains decimal; this is a read-only convenience for the UI and
 * is never treated as authoritative stored data.
 */
export function formatMoney(value: number | string): string {
  const amount = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(amount)) {
    return "";
  }
  return new Intl.NumberFormat("lt-LT", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

/** Display-only short date/time for a receipt timestamp. */
export function formatReceiptDate(iso: string): string {
  return new Intl.DateTimeFormat("lt-LT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}
