/** Placeholder for a missing optional value in read-only views. */
export const EMPTY_VALUE = "—";

/** Render an optional value or the empty placeholder. */
export function valueOrPlaceholder(value: string | null): string {
  return value && value.trim() !== "" ? value : EMPTY_VALUE;
}

/** Lithuanian active/inactive label for any entity with an `active` flag. */
export function activeStatusLabel(active: boolean): string {
  return active ? "Aktyvus" : "Neaktyvus";
}

/**
 * Display-only EUR formatting of a decimal string/number.
 *
 * Persistence remains decimal; this is a read-only convenience for the UI and is
 * never treated as authoritative stored data.
 */
export function formatMoney(value: number | string): string {
  const amount = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(amount)) {
    return "";
  }
  return new Intl.NumberFormat("lt-LT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
