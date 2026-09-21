import type { Resource, ResourceCategoryKey } from "@aitvaras/contracts";

/** Row shape returned when a resource is loaded. */
export interface ResourceRecord {
  id: string;
  name: string;
  category: string;
  notes: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Map a database resource to the shared public representation. */
export function toResource(record: ResourceRecord): Resource {
  return {
    id: record.id,
    name: record.name,
    category: record.category as ResourceCategoryKey,
    notes: record.notes,
    active: record.active,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
