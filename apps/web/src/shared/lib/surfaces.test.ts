import { describe, expect, it } from "vitest";
import { WORK_SURFACE_CLASS, workSurfaceClass } from "./surfaces";

describe("surface classes", () => {
  it("uses a subtle neutral background for active work areas", () => {
    expect(workSurfaceClass()).toContain("bg-muted");
    expect(workSurfaceClass()).not.toContain("bg-card");
  });

  it("shares the card chrome (radius, border, padding)", () => {
    expect(WORK_SURFACE_CLASS).toContain("rounded-xl");
    expect(WORK_SURFACE_CLASS).toContain("border");
    expect(WORK_SURFACE_CLASS).toContain("p-6");
  });

  it("appends extra classes", () => {
    expect(workSurfaceClass("mt-4")).toBe(`${WORK_SURFACE_CLASS} mt-4`);
  });
});
