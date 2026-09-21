import type { PackingForm } from "@aitvaras/contracts";

/** Row shape returned when a packing form is loaded. */
export interface PackingFormRecord {
  id: string;
  name: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Map a database packing form to the shared public representation. */
export function toPackingForm(record: PackingFormRecord): PackingForm {
  return {
    id: record.id,
    name: record.name,
    active: record.active,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
