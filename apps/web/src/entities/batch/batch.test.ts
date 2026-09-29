import { describe, expect, it } from "vitest";
import {
  bagLocationLabel,
  batchStatusLabel,
  EMPTY_BATCHES_MESSAGE,
  formatWeight,
  isBatchOpen,
} from "./batch";

describe("batch status", () => {
  it("maps status keys to Lithuanian labels", () => {
    expect(batchStatusLabel("PENDING")).toBe("Laukiama patvirtinimo");
    expect(batchStatusLabel("CONFIRMED")).toBe("Patvirtinta");
    expect(batchStatusLabel("DISCREPANCY")).toBe("Neatitikimas");
  });

  it("treats only pending batches as open for new bags", () => {
    expect(isBatchOpen("PENDING")).toBe(true);
    expect(isBatchOpen("CONFIRMED")).toBe(false);
    expect(isBatchOpen("DISCREPANCY")).toBe(false);
  });
});

describe("formatWeight", () => {
  it("formats a decimal string with three decimals and a kg suffix", () => {
    expect(formatWeight("1234.5")).toContain("kg");
    expect(formatWeight("1234.5").replace(/\s/g, "")).toContain("1234,500");
  });

  it("returns an empty string for a non-numeric value", () => {
    expect(formatWeight("nope")).toBe("");
  });
});

describe("bagLocationLabel", () => {
  it("shows the location name when present", () => {
    expect(bagLocationLabel("Stelažas A1")).toBe("Stelažas A1");
  });

  it("shows the empty placeholder when absent", () => {
    expect(bagLocationLabel(null)).toBe("—");
  });
});

describe("empty state", () => {
  it("exposes the empty-state text", () => {
    expect(EMPTY_BATCHES_MESSAGE).toBe("Partijų dar nėra.");
  });
});
