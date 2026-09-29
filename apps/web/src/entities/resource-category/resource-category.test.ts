import { describe, expect, it } from "vitest";
import type { ResourceCategory } from "@aitvaras/contracts";
import {
  EMPTY_RESOURCE_CATEGORIES_MESSAGE,
  activeResourceCategories,
  resourceCategoryOptionLabel,
  selectableResourceCategories,
} from "./resource-category";

function category(id: string, active: boolean, name = id): ResourceCategory {
  return {
    id,
    name,
    active,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("activeResourceCategories", () => {
  it("keeps only active categories", () => {
    const selected = activeResourceCategories([
      category("a", true),
      category("b", false),
    ]);
    expect(selected.map((item) => item.id)).toEqual(["a"]);
  });
});

describe("selectableResourceCategories", () => {
  it("offers only active categories when creating", () => {
    const selected = selectableResourceCategories([
      category("a", true),
      category("b", false),
    ]);
    expect(selected.map((item) => item.id)).toEqual(["a"]);
  });

  it("keeps the currently assigned inactive category when editing", () => {
    const selected = selectableResourceCategories(
      [category("a", true), category("b", false)],
      "b",
    );
    expect(selected.map((item) => item.id)).toEqual(["a", "b"]);
  });
});

describe("resourceCategoryOptionLabel", () => {
  it("flags inactive categories", () => {
    expect(resourceCategoryOptionLabel(category("a", true, "Žaliava"))).toBe(
      "Žaliava",
    );
    expect(resourceCategoryOptionLabel(category("b", false, "Pakuotė"))).toBe(
      "Pakuotė (neaktyvi)",
    );
  });
});

describe("empty message", () => {
  it("is Lithuanian", () => {
    expect(EMPTY_RESOURCE_CATEGORIES_MESSAGE).toBe("Kategorijų dar nėra.");
  });
});
