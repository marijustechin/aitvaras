import { describe, expect, it } from "vitest";
import { EMPTY_VALUE, activeStatusLabel, formatMoney, valueOrPlaceholder } from "./format";

describe("valueOrPlaceholder", () => {
  it("renders the placeholder for null, undefined-like and blank values", () => {
    expect(valueOrPlaceholder(null)).toBe(EMPTY_VALUE);
    expect(valueOrPlaceholder("  ")).toBe(EMPTY_VALUE);
  });

  it("renders the value when present", () => {
    expect(valueOrPlaceholder("UAB Mediena")).toBe("UAB Mediena");
  });
});

describe("activeStatusLabel", () => {
  it("labels the active state in Lithuanian", () => {
    expect(activeStatusLabel(true)).toBe("Aktyvus");
    expect(activeStatusLabel(false)).toBe("Neaktyvus");
  });
});

describe("formatMoney", () => {
  it("formats a decimal string as EUR for display", () => {
    const formatted = formatMoney("1775");
    expect(formatted).toContain("€");
    expect(formatted.replace(/\s/g, "")).toContain("1775,00");
  });

  it("returns an empty string for a non-numeric value", () => {
    expect(formatMoney("nope")).toBe("");
  });
});
