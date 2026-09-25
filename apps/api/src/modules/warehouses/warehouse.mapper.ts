import type {
  Warehouse,
  WarehouseLocation,
  WarehouseWithLocations,
} from "@aitvaras/contracts";

export interface WarehouseRecord {
  id: string;
  name: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WarehouseLocationRecord {
  id: string;
  warehouseId: string;
  name: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toWarehouse(record: WarehouseRecord): Warehouse {
  return {
    id: record.id,
    name: record.name,
    active: record.active,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toWarehouseLocation(
  record: WarehouseLocationRecord,
): WarehouseLocation {
  return {
    id: record.id,
    warehouseId: record.warehouseId,
    name: record.name,
    active: record.active,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toWarehouseWithLocations(
  record: WarehouseRecord & { locations: WarehouseLocationRecord[] },
): WarehouseWithLocations {
  return {
    ...toWarehouse(record),
    locations: record.locations.map(toWarehouseLocation),
  };
}
