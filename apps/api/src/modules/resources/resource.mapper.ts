import type { Resource } from "@aitvaras/contracts";

/** Row shape returned when a resource is loaded (category included). */
export interface ResourceRecord {
  id: string;
  name: string;
  categoryId: string;
  notes: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  category: { id: string; name: string; active: boolean };
}

/** Map a database resource to the shared public representation. */
export function toResource(record: ResourceRecord): Resource {
  return {
    id: record.id,
    name: record.name,
    categoryId: record.categoryId,
    categoryName: record.category.name,
    categoryActive: record.category.active,
    notes: record.notes,
    active: record.active,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
