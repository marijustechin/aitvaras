import { describe, expect, it } from "vitest";
import { inactiveRowClass, toggleActionClass } from "./row-styles";

describe("inactiveRowClass", () => {
  it("mutes inactive rows", () => {
    expect(inactiveRowClass(false)).toContain("text-muted-foreground");
  });

  it("leaves active rows unstyled", () => {
    expect(inactiveRowClass(true)).toBe("");
  });
});

describe("action classes", () => {
  it("uses destructive styling for Išjungti (active record)", () => {
    expect(toggleActionClass(true)).toContain("text-destructive");
    expect(toggleActionClass(true)).toContain("border-destructive");
  });

  it("keeps Įjungti neutral (inactive record)", () => {
    const cls = toggleActionClass(false);
    expect(cls).not.toContain("destructive");
    expect(cls).toContain("border-border");
  });

  it("keeps focus-visible styling on both actions", () => {
    expect(toggleActionClass(true)).toContain("focus-visible:ring-2");
    expect(toggleActionClass(false)).toContain("focus-visible:ring-2");
  });
});

describe("detail-level actions", () => {
  it("uses destructive intent for an active entity (Išjungti)", () => {
    const cls = toggleActionClass(true, "detail");
    expect(cls).toContain("text-destructive");
    expect(cls).toContain("border-destructive/40");
    expect(cls).toContain("px-3 py-2 text-sm");
  });

  it("uses neutral intent for an inactive entity (Įjungti)", () => {
    const cls = toggleActionClass(false, "detail");
    expect(cls).toContain("border-border");
    expect(cls).not.toContain("destructive");
    expect(cls).toContain("px-3 py-2 text-sm");
  });

  it("defaults to table sizing", () => {
    const cls = toggleActionClass(true);
    expect(cls).toContain("px-2 py-1 text-xs");
    expect(cls).not.toContain("px-3 py-2 text-sm");
  });
});
