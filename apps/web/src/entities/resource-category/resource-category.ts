import type { ResourceCategory } from "@aitvaras/contracts";

/** Empty-state text for the resource-categories list. */
export const EMPTY_RESOURCE_CATEGORIES_MESSAGE = "Kategorijų dar nėra.";

/** Active categories only (used when selecting a category for a new resource). */
export function activeResourceCategories(
  categories: readonly ResourceCategory[],
): ResourceCategory[] {
  return categories.filter((category) => category.active);
}

/**
 * Categories selectable in a resource form.
 *
 * All active categories, plus (when editing) the currently assigned category even
 * if it is inactive, so an existing relationship stays visible and is not lost.
 */
export function selectableResourceCategories(
  categories: readonly ResourceCategory[],
  currentCategoryId?: string,
): ResourceCategory[] {
  return categories.filter(
    (category) => category.active || category.id === currentCategoryId,
  );
}

/** Lithuanian option label for a category, flagging inactive ones. */
export function resourceCategoryOptionLabel(category: ResourceCategory): string {
  return category.active ? category.name : `${category.name} (neaktyvi)`;
}
