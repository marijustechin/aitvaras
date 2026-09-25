import type {
  Warehouse,
  WarehouseLocation,
  WarehouseWithLocations,
} from "@aitvaras/contracts";

/** Empty-state text for the warehouses list. */
export const EMPTY_WAREHOUSES_MESSAGE = "Sandėlių dar nėra.";

/** Empty-state text for a warehouse's locations. */
export const EMPTY_LOCATIONS_MESSAGE = "Sandėlio vietų dar nėra.";

/** Active warehouses, for selection (server still validates). */
export function activeWarehouses(
  warehouses: readonly WarehouseWithLocations[],
): WarehouseWithLocations[] {
  return warehouses.filter((warehouse) => warehouse.active);
}

/** Active locations of a warehouse, ordered as returned by the API. */
export function activeLocations(
  warehouse: WarehouseWithLocations,
): WarehouseLocation[] {
  return warehouse.locations.filter((location) => location.active);
}

/**
 * Active locations belonging to a warehouse id. An unknown or unselected
 * warehouse yields an empty list, so the dependent selector stays empty until a
 * warehouse is chosen.
 */
export function locationsForWarehouse(
  warehouses: readonly WarehouseWithLocations[],
  warehouseId: string,
): WarehouseLocation[] {
  if (!warehouseId) {
    return [];
  }
  const warehouse = warehouses.find((item) => item.id === warehouseId);
  return warehouse ? activeLocations(warehouse) : [];
}

/** True when a location id is currently selectable for the given warehouse. */
export function isLocationInWarehouse(
  warehouses: readonly WarehouseWithLocations[],
  warehouseId: string,
  locationId: string,
): boolean {
  return locationsForWarehouse(warehouses, warehouseId).some(
    (location) => location.id === locationId,
  );
}

export type { Warehouse, WarehouseLocation, WarehouseWithLocations };
