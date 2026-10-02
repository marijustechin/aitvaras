import { describe, expect, it } from "vitest";
import {
  createSettlementDraft,
  settlementFormError,
  toCreateSettlementPayload,
  type SettlementDraft,
} from "./settlement-form";

function draft(overrides: Partial<SettlementDraft> = {}): SettlementDraft {
  return { ...createSettlementDraft(), ...overrides };
}

describe("createSettlementDraft", () => {
  it("defaults to a weight settlement with EUR", () => {
    const value = createSettlementDraft();
    expect(value.type).toBe("WEIGHT");
    expect(value.coveredWeightKg).toBe("");
    expect(value.currency).toBe("EUR");
  });
});

describe("settlementFormError", () => {
  it("requires a positive covered weight within the remaining balance", () => {
    expect(settlementFormError(draft(), "20.000")).toBeTruthy();
    expect(
      settlementFormError(draft({ coveredWeightKg: "0" }), "20.000"),
    ).toBeTruthy();
    expect(
      settlementFormError(draft({ coveredWeightKg: "25" }), "20.000"),
    ).toBeTruthy();
    expect(
      settlementFormError(draft({ coveredWeightKg: "20" }), "20.000"),
    ).toBeNull();
  });

  it("requires money amount and currency for a money settlement", () => {
    expect(
      settlementFormError(
        draft({ type: "MONEY", coveredWeightKg: "5" }),
        "20.000",
      ),
    ).toBeTruthy();
    expect(
      settlementFormError(
        draft({
          type: "MONEY",
          coveredWeightKg: "5",
          moneyAmount: "45",
          currency: "",
        }),
        "20.000",
      ),
    ).toBeTruthy();
    expect(
      settlementFormError(
        draft({
          type: "MONEY",
          coveredWeightKg: "5",
          moneyAmount: "45",
          currency: "EUR",
        }),
        "20.000",
      ),
    ).toBeNull();
  });
});

describe("toCreateSettlementPayload", () => {
  it("omits empty optional fields for a weight settlement", () => {
    expect(toCreateSettlementPayload(draft({ coveredWeightKg: "8" }))).toEqual({
      type: "WEIGHT",
      coveredWeightKg: "8",
      reference: undefined,
      note: undefined,
    });
  });

  it("includes an optional source batch for a weight settlement", () => {
    expect(
      toCreateSettlementPayload(
        draft({ coveredWeightKg: "8", sourceBatchId: "batch-1" }),
      ),
    ).toMatchObject({ type: "WEIGHT", sourceBatchId: "batch-1" });
  });

  it("includes money amount and currency (no source batch) for money", () => {
    expect(
      toCreateSettlementPayload(
        draft({
          type: "MONEY",
          coveredWeightKg: "20",
          moneyAmount: "45",
          currency: "EUR",
          sourceBatchId: "ignored",
        }),
      ),
    ).toEqual({
      type: "MONEY",
      coveredWeightKg: "20",
      reference: undefined,
      note: undefined,
      moneyAmount: "45",
      currency: "EUR",
    });
  });
});
