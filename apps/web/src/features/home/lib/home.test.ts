import { describe, expect, it } from "vitest";
import { homeShowsReceivingAction } from "./home";

describe("homeShowsReceivingAction", () => {
  it("shows the warehouse receiving action to receiving roles", () => {
    expect(homeShowsReceivingAction(["WAREHOUSE_WORKER"])).toBe(true);
    expect(homeShowsReceivingAction(["ADMIN"])).toBe(true);
  });

  it("keeps the generic home for other roles", () => {
    expect(homeShowsReceivingAction(["ACCOUNTING"])).toBe(false);
    expect(homeShowsReceivingAction(["PRODUCTION_MANAGER"])).toBe(false);
  });
});
