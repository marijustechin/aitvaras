import { describe, expect, it } from "vitest";
import { Prisma } from "@aitvaras/database";
import { summarizeStock } from "./stock-summary";

function decimal(value: string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

describe("summarizeStock", () => {
  it("returns explicit zero quantities and zero value for empty stock", () => {
    expect(
      summarizeStock({ weightKg: null, pieces: null, batches: [] }),
    ).toEqual({
      weight: {
        quantityKg: "0",
        value: "0",
        valuationIncomplete: false,
      },
      pieces: { quantity: 0, value: "0", valuationIncomplete: false },
    });
  });

  it("keeps weight and pieces separate", () => {
    const summary = summarizeStock({
      weightKg: decimal("13.900"),
      pieces: 5,
      batches: [
        {
          receivingMode: "WEIGHT",
          acquisitionAmount: decimal("100.00"),
          activeBagCount: 2,
          activeItemCount: 0,
        },
        {
          receivingMode: "PIECE",
          acquisitionAmount: decimal("50.00"),
          activeBagCount: 0,
          activeItemCount: 2,
        },
      ],
    });
    expect(summary.weight).toEqual({
      quantityKg: "13.9",
      value: "100",
      valuationIncomplete: false,
    });
    expect(summary.pieces).toEqual({
      quantity: 5,
      value: "50",
      valuationIncomplete: false,
    });
  });

  it("adds acquisition cost once per confirmed batch, not per bag or line", () => {
    const summary = summarizeStock({
      weightKg: decimal("30"),
      pieces: 0,
      batches: [
        {
          receivingMode: "WEIGHT",
          acquisitionAmount: decimal("100.00"),
          activeBagCount: 12,
          activeItemCount: 0,
        },
      ],
    });
    expect(summary.weight.value).toBe("100");
  });

  it("adds frozen receipt expense shares once per confirmed batch", () => {
    const summary = summarizeStock({
      weightKg: decimal("30"),
      pieces: 0,
      batches: [
        {
          receivingMode: "WEIGHT",
          acquisitionAmount: decimal("100.00"),
          allocatedTransportAmount: decimal("20.00"),
          allocatedCustomsAmount: decimal("5.00"),
          activeBagCount: 12,
          activeItemCount: 0,
        },
      ],
    });
    expect(summary.weight.value).toBe("125");
  });

  it("retains quantity when valuation is missing and flags it", () => {
    const summary = summarizeStock({
      weightKg: decimal("10"),
      pieces: 3,
      batches: [
        {
          receivingMode: "WEIGHT",
          acquisitionAmount: decimal("100.00"),
          activeBagCount: 1,
          activeItemCount: 0,
        },
        {
          receivingMode: "WEIGHT",
          acquisitionAmount: null,
          activeBagCount: 2,
          activeItemCount: 0,
        },
        {
          receivingMode: "PIECE",
          acquisitionAmount: null,
          activeBagCount: 0,
          activeItemCount: 1,
        },
      ],
    });
    expect(summary.weight.quantityKg).toBe("10");
    expect(summary.weight.value).toBe("100");
    expect(summary.weight.valuationIncomplete).toBe(true);
    expect(summary.pieces.quantity).toBe(3);
    expect(summary.pieces.value).toBeNull();
    expect(summary.pieces.valuationIncomplete).toBe(true);
  });

  it("does not treat missing valuation as zero when no cost is known", () => {
    const summary = summarizeStock({
      weightKg: decimal("7.5"),
      pieces: 0,
      batches: [
        {
          receivingMode: "WEIGHT",
          acquisitionAmount: null,
          activeBagCount: 1,
          activeItemCount: 0,
        },
      ],
    });
    expect(summary.weight.quantityKg).toBe("7.5");
    expect(summary.weight.value).toBeNull();
    expect(summary.weight.valuationIncomplete).toBe(true);
  });

  it("ignores confirmed batches with no remaining active units", () => {
    const summary = summarizeStock({
      weightKg: null,
      pieces: null,
      batches: [
        {
          receivingMode: "WEIGHT",
          acquisitionAmount: null,
          activeBagCount: 0,
          activeItemCount: 0,
        },
      ],
    });
    expect(summary.weight.value).toBe("0");
    expect(summary.weight.valuationIncomplete).toBe(false);
  });
});
