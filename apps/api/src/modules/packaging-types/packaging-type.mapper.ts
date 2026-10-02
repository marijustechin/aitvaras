import type { PackagingType } from "@aitvaras/contracts";

/** Row shape returned when a packaging type is loaded. */
export interface PackagingTypeRecord {
  id: string;
  name: string;
  tareWeightKg: { toString(): string };
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Map a database packaging type to the shared public representation. */
export function toPackagingType(record: PackagingTypeRecord): PackagingType {
  return {
    id: record.id,
    name: record.name,
    tareWeightKg: record.tareWeightKg.toString(),
    active: record.active,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
