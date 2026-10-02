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
