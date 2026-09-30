import { describe, expect, it } from "vitest";
import {
  bagLocationLabel,
  bagStatusClass,
  bagStatusLabel,
  batchStatusLabel,
  canReceiveStock,
  correctionKindLabel,
  EMPTY_BATCHES_MESSAGE,
  EMPTY_CORRECTIONS_MESSAGE,
  formatQuantity,
  formatWeight,
  formatWeightDifference,
  GAVIMAI_ACTION,
  handlingUnitLabel,
  isBatchConfirmed,
  isBatchOpen,
  RECEIVE_ACTION,
  RECEIVING_ROLES,
  weightsMatch,
} from "./batch";

describe("batch status", () => {
  it("maps status keys to Lithuanian labels", () => {
    expect(batchStatusLabel("PENDING")).toBe("Laukiama patvirtinimo");
    expect(batchStatusLabel("CONFIRMED")).toBe("Patvirtinta");
    expect(batchStatusLabel("DISCREPANCY")).toBe("Neatitikimas");
  });

  it("treats pending and discrepant batches as open for bag changes", () => {
    expect(isBatchOpen("PENDING")).toBe(true);
    expect(isBatchOpen("DISCREPANCY")).toBe(true);
    expect(isBatchOpen("CONFIRMED")).toBe(false);
  });

  it("treats only CONFIRMED as confirmed (terminal)", () => {
    expect(isBatchConfirmed("CONFIRMED")).toBe(true);
    expect(isBatchConfirmed("DISCREPANCY")).toBe(false);
    expect(isBatchConfirmed("PENDING")).toBe(false);
  });
});

describe("handling unit status and corrections", () => {
  it("maps unit statuses to Lithuanian labels", () => {
    expect(bagStatusLabel("ACTIVE")).toBe("Aktyvus");
    expect(bagStatusLabel("VOIDED")).toBe("Anuliuotas");
  });

  it("uses restrained semantic colours (voided = destructive)", () => {
    expect(bagStatusClass("VOIDED")).toContain("destructive");
    expect(bagStatusClass("ACTIVE")).toContain("muted");
  });

  it("maps correction kinds to Lithuanian labels and has an empty state", () => {
    expect(correctionKindLabel("QUANTITY")).toBe("Kiekio pataisymas");
    expect(correctionKindLabel("LOCATION")).toBe("Vietos pataisymas");
    expect(correctionKindLabel("VOID")).toBe("Anuliavimas");
    expect(EMPTY_CORRECTIONS_MESSAGE).toBe("Pataisymų dar nėra.");
  });
});

describe("reconciliation difference", () => {
  it("formats a signed difference with the weight precision", () => {
    expect(formatWeightDifference("10.25", "10")).toContain("0,250");
    expect(formatWeightDifference("10", "10")).toContain("0,000");
    // lt-LT renders the minus sign as U+2212.
    expect((formatWeightDifference("9.5", "10") ?? "").replace(/\s/g, "")).toContain(
      "\u22120,500",
    );
  });

  it("returns null when there is no documentary weight", () => {
    expect(formatWeightDifference(null, "10")).toBeNull();
    expect(formatWeightDifference("", "10")).toBeNull();
  });

  it("matches weights exactly (no tolerance)", () => {
    expect(weightsMatch("10.000", "10")).toBe(true);
    expect(weightsMatch("10.001", "10")).toBe(false);
    expect(weightsMatch(null, "10")).toBe(false);
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

describe("formatQuantity", () => {
  it("formats KG with the 3-decimal weight convention", () => {
    expect(formatQuantity("48.725", "KG").replace(/\s/g, "")).toBe("48,725kg");
  });

  it("formats PCS as whole units", () => {
    expect(formatQuantity("12", "PCS")).toBe("12 vnt");
    expect(formatQuantity(7, "PCS")).toBe("7 vnt");
  });

  it("returns an empty string for a non-numeric value", () => {
    expect(formatQuantity("nope", "KG")).toBe("");
  });
});

describe("handlingUnitLabel", () => {
  it("maps units to Lithuanian short labels", () => {
    expect(handlingUnitLabel("KG")).toBe("kg");
    expect(handlingUnitLabel("PCS")).toBe("vnt");
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

describe("receiving capability", () => {
  it("lists ADMIN and WAREHOUSE_WORKER as receiving roles", () => {
    expect(RECEIVING_ROLES).toEqual(["ADMIN", "WAREHOUSE_WORKER"]);
  });

  it("grants receiving only to receiving roles", () => {
    expect(canReceiveStock(["WAREHOUSE_WORKER"])).toBe(true);
    expect(canReceiveStock(["ADMIN"])).toBe(true);
    expect(canReceiveStock(["ACCOUNTING"])).toBe(false);
    expect(canReceiveStock([])).toBe(false);
  });

  it("exposes the workplace action label and route", () => {
    expect(RECEIVE_ACTION.label).toBe("Registruoti sandėlyje");
    expect(RECEIVE_ACTION.href).toBe("/receiving");
  });

  it("exposes the ADMIN received-batch queue action", () => {
    expect(GAVIMAI_ACTION.label).toBe("Gavimai");
    expect(GAVIMAI_ACTION.href).toBe("/receipts");
  });
});
