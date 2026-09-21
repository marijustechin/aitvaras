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
