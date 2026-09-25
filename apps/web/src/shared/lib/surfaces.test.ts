import { describe, expect, it } from "vitest";
import {
  DEFAULT_SURFACE_CLASS,
  WORK_SURFACE_CLASS,
  defaultSurfaceClass,
  workSurfaceClass,
} from "./surfaces";

describe("surface classes", () => {
  it("uses a subtle neutral background for active work areas", () => {
    expect(workSurfaceClass()).toContain("bg-muted");
    expect(workSurfaceClass()).not.toContain("bg-card");
  });

  it("uses the default white card for list/read-only surfaces", () => {
    expect(defaultSurfaceClass()).toContain("bg-card");
    expect(defaultSurfaceClass()).not.toContain("bg-muted");
  });

  it("shares the card chrome (radius, border, padding)", () => {
    for (const cls of [WORK_SURFACE_CLASS, DEFAULT_SURFACE_CLASS]) {
      expect(cls).toContain("rounded-xl");
      expect(cls).toContain("border");
      expect(cls).toContain("p-6");
    }
  });

  it("distinguishes work vs default surfaces and appends extras", () => {
    expect(WORK_SURFACE_CLASS).not.toBe(DEFAULT_SURFACE_CLASS);
    expect(workSurfaceClass("mt-4")).toBe(`${WORK_SURFACE_CLASS} mt-4`);
    expect(defaultSurfaceClass("mt-4")).toBe(`${DEFAULT_SURFACE_CLASS} mt-4`);
  });
});
