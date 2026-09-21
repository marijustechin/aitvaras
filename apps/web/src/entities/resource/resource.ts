import {
  RESOURCE_CATEGORY_LABELS,
  type ResourceCategoryKey,
} from "@aitvaras/contracts";

/** Empty-state text for the resources list. */
export const EMPTY_RESOURCES_MESSAGE = "Išteklių dar nėra.";

/** Lithuanian UI label for a resource category (never the raw key). */
export function resourceCategoryLabel(category: ResourceCategoryKey): string {
  return RESOURCE_CATEGORY_LABELS[category];
}
