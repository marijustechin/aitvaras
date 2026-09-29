import type { ResourceCategory } from "@aitvaras/contracts";

/** Row shape returned when a resource category is loaded. */
export interface ResourceCategoryRecord {
  id: string;
  name: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Map a database resource category to the shared public representation. */
export function toResourceCategory(
  record: ResourceCategoryRecord,
): ResourceCategory {
  return {
    id: record.id,
    name: record.name,
    active: record.active,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
