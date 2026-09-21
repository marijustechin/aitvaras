import { describe, expect, it } from "vitest";
import { EMPTY_RESOURCES_MESSAGE, resourceCategoryLabel } from "./resource";

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
