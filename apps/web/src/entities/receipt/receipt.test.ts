import { describe, expect, it } from "vitest";
import {
  EMPTY_RECEIPTS_MESSAGE,
  formatMoney,
  receiptLocationLabel,
  receiptUnitLabel,
} from "./receipt";

describe("receipt unit labels", () => {
  it("maps unit keys to Lithuanian shorthand", () => {
    expect(receiptUnitLabel("KG")).toBe("kg");
    expect(receiptUnitLabel("UNIT")).toBe("vnt.");
  });
});

describe("receiptLocationLabel", () => {
  it("shows the location name when present", () => {
    expect(receiptLocationLabel("Stelažas A1")).toBe("Stelažas A1");
  });

  it("shows the empty placeholder when no location was recorded", () => {
    expect(receiptLocationLabel(null)).toBe("—");
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

describe("empty state", () => {
  it("exposes the empty-state text", () => {
    expect(EMPTY_RECEIPTS_MESSAGE).toBe("Pajamavimų dar nėra.");
  });
});
