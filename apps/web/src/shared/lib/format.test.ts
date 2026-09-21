import { describe, expect, it } from "vitest";
import { EMPTY_VALUE, activeStatusLabel, valueOrPlaceholder } from "./format";

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
