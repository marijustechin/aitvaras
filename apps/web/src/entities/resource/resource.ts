import {
  RESOURCE_CATEGORY_LABELS,
  type Resource,
  type ResourceCategoryKey,
} from "@aitvaras/contracts";

/** Empty-state text for the resources list. */
export const EMPTY_RESOURCES_MESSAGE = "Išteklių dar nėra.";

/** Lithuanian UI label for a resource category (never the raw key). */
export function resourceCategoryLabel(category: ResourceCategoryKey): string {
  return RESOURCE_CATEGORY_LABELS[category];
}

/** Active resources, for receipt-line selection (server still validates). */
export function activeResources(resources: readonly Resource[]): Resource[] {
  return resources.filter((resource) => resource.active);
}
