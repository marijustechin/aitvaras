import { describe, expect, it } from "vitest";
import type { Resource } from "@aitvaras/contracts";
import {
  EMPTY_RESOURCES_MESSAGE,
  activeResources,
  resourceCategoryLabel,
} from "./resource";

describe("resource category mapping", () => {
  it("maps resource category keys to Lithuanian labels", () => {
    expect(resourceCategoryLabel("RAW_MATERIAL")).toBe("Žaliava");
    expect(resourceCategoryLabel("SEMI_FINISHED")).toBe("Pusgaminis");
    expect(resourceCategoryLabel("FINISHED_PRODUCT")).toBe("Gaminys");
  });

  it("exposes the empty-state text", () => {
    expect(EMPTY_RESOURCES_MESSAGE).toBe("Išteklių dar nėra.");
  });
});

function resource(id: string, active: boolean): Resource {
  return {
    id,
    name: id,
    category: "RAW_MATERIAL",
    notes: null,
    active,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("activeResources", () => {
  it("keeps only active resources", () => {
    const selected = activeResources([
      resource("a", true),
      resource("b", false),
    ]);
    expect(selected.map((item) => item.id)).toEqual(["a"]);
  });
});
