import { describe, expect, it } from "vitest";
import {
  DISABLE_ACTION_CLASS,
  ENABLE_ACTION_CLASS,
  disableActionClass,
  enableActionClass,
  inactiveRowClass,
  toggleActionClass,
} from "./row-styles";

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
    expect(disableActionClass()).toContain("text-destructive");
    expect(toggleActionClass(true)).toContain("text-destructive");
    expect(DISABLE_ACTION_CLASS).toContain("border-destructive");
  });

  it("keeps Įjungti neutral (inactive record)", () => {
    const cls = toggleActionClass(false);
    expect(cls).toBe(ENABLE_ACTION_CLASS);
    expect(cls).not.toContain("destructive");
    expect(enableActionClass()).not.toContain("destructive");
  });

  it("keeps focus-visible styling on both actions", () => {
    expect(disableActionClass()).toContain("focus-visible:ring-2");
    expect(enableActionClass()).toContain("focus-visible:ring-2");
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
    expect(toggleActionClass(true)).toBe(DISABLE_ACTION_CLASS);
    expect(toggleActionClass(false)).toBe(ENABLE_ACTION_CLASS);
  });
});
