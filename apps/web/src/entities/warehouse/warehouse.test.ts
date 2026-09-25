import { describe, expect, it } from "vitest";
import type { WarehouseWithLocations } from "@aitvaras/contracts";
import {
  EMPTY_LOCATIONS_MESSAGE,
  EMPTY_WAREHOUSES_MESSAGE,
  activeLocations,
  activeWarehouses,
  isLocationInWarehouse,
  locationsForWarehouse,
} from "./warehouse";

function location(id: string, active = true) {
  return {
    id,
    warehouseId: "w",
    name: id,
    active,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function warehouse(
  id: string,
  active = true,
  locations = [] as ReturnType<typeof location>[],
): WarehouseWithLocations {
  return {
    id,
    name: id,
    active,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    locations,
  };
}

describe("warehouse selectors", () => {
  it("lists only active warehouses", () => {
    expect(activeWarehouses([warehouse("a"), warehouse("b", false)]).map((w) => w.id)).toEqual([
      "a",
    ]);
  });

  it("returns active locations for a warehouse id", () => {
    const data = [
      warehouse("a", true, [location("a1"), location("a2", false)]),
      warehouse("b", true, [location("b1")]),
    ];
    expect(locationsForWarehouse(data, "a").map((l) => l.id)).toEqual(["a1"]);
    expect(locationsForWarehouse(data, "b").map((l) => l.id)).toEqual(["b1"]);
  });

  it("returns nothing before a warehouse is selected", () => {
    expect(locationsForWarehouse([warehouse("a", true, [location("a1")])], "")).toEqual(
      [],
    );
  });

  it("detects whether a location belongs to a warehouse", () => {
    const data = [warehouse("a", true, [location("a1")])];
    expect(isLocationInWarehouse(data, "a", "a1")).toBe(true);
    expect(isLocationInWarehouse(data, "a", "b1")).toBe(false);
    expect(isLocationInWarehouse(data, "", "a1")).toBe(false);
  });

  it("filters active locations", () => {
    expect(activeLocations(warehouse("a", true, [location("a1", false)])).length).toBe(0);
  });

  it("exposes empty-state texts", () => {
    expect(EMPTY_WAREHOUSES_MESSAGE).toBe("Sandėlių dar nėra.");
    expect(EMPTY_LOCATIONS_MESSAGE).toBe("Sandėlio vietų dar nėra.");
  });
});
