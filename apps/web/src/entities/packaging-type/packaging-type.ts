import type { PackagingType } from "@aitvaras/contracts";

/** Empty-state text for the packaging-type list. */
export const EMPTY_PACKAGING_TYPES_MESSAGE = "Taros dar nėra.";

/**
 * Packaging types selectable for **new** receiving: active only, name-sorted.
 * Historical packages may still reference inactive types.
 */
export function activePackagingTypes(
  types: readonly PackagingType[],
): PackagingType[] {
  return types
    .filter((type) => type.active)
    .sort((a, b) => a.name.localeCompare(b.name, "lt"));
}

/** Find one packaging type by id (active or historical), or null. */
export function findPackagingType(
  types: readonly PackagingType[],
  id: string,
): PackagingType | null {
  return types.find((type) => type.id === id) ?? null;
}

/**
 * Lithuanian tare weight for selector labels: at least one decimal, up to the
 * stored three-decimal precision (`0,2`, `27,0`, `0,125`).
 */
export function formatTareWeightKg(value: string | number): string {
  const amount = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(amount)) {
    return "";
  }
  return new Intl.NumberFormat("lt-LT", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 3,
  }).format(amount);
}

/** Selector option label: `Dėžė (0,2 kg)`. */
export function packagingTypeOptionLabel(type: PackagingType): string {
  return `${type.name} (${formatTareWeightKg(type.tareWeightKg)} kg)`;
}
