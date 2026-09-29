import type { Resource } from "@aitvaras/contracts";

/** Empty-state text for the resources list. */
export const EMPTY_RESOURCES_MESSAGE = "Išteklių dar nėra.";

/** Active resources, for receipt-line selection (server still validates). */
export function activeResources(resources: readonly Resource[]): Resource[] {
  return resources.filter((resource) => resource.active);
}
