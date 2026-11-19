import { Prisma } from "@aitvaras/database";
import { describe, expect, it } from "vitest";
import {
  allocateExpenses,
  allocationBasis,
  isMixedReceipt,
  MissingAcquisitionValueError,
  proportionalEligibility,
  ZeroAcquisitionBasisError,
  type ExpenseAllocationBatch,
} from "./expense-allocation";

function batch(
  id: string,
  code: string,
  receivingMode: "WEIGHT" | "PIECE",
  quantity: string,
  acquisitionAmount: string | null = null,
): ExpenseAllocationBatch {
  return {
    id,
    code,
    receivingMode,
    quantity: new Prisma.Decimal(quantity),
    acquisitionAmount:
      acquisitionAmount === null ? null : new Prisma.Decimal(acquisitionAmount),
  };
}

function amounts(
  value: Map<string, { transport: Prisma.Decimal; customs: Prisma.Decimal }>,
  id: string,
): { transport: string; customs: string } {
  const share = value.get(id);
  if (!share) {
    throw new Error(`missing share for ${id}`);
  }
  return {
    transport: share.transport.toString(),
    customs: share.customs.toString(),
  };
}

describe("allocateExpenses", () => {
  const weightBatches = [
    batch("p01", "P01", "WEIGHT", "10"),
    batch("p02", "P02", "WEIGHT", "30"),
  ];

  it("allocates all-WEIGHT expenses by actual net kg", () => {
    expect(allocationBasis(weightBatches)).toBe("NET_WEIGHT");
    const shares = allocateExpenses(
      weightBatches,
      "BY_VALUE",
      new Prisma.Decimal(80),
      new Prisma.Decimal(20),
    );
    expect(amounts(shares, "p01")).toEqual({ transport: "20", customs: "5" });
    expect(amounts(shares, "p02")).toEqual({ transport: "60", customs: "15" });
  });

  it("allocates all-PIECE expenses by actual pieces", () => {
    const pieces = [
      batch("p01", "P01", "PIECE", "10", "100"),
      batch("p02", "P02", "PIECE", "30", "300"),
    ];
    expect(allocationBasis(pieces)).toBe("PIECES");
    const shares = allocateExpenses(
      pieces,
      "BY_VALUE",
      new Prisma.Decimal(80),
      new Prisma.Decimal(20),
    );
    expect(amounts(shares, "p01")).toEqual({ transport: "20", customs: "5" });
    expect(amounts(shares, "p02")).toEqual({ transport: "60", customs: "15" });
  });

  it("splits equally and keeps cent totals exact", () => {
    const shares = allocateExpenses(
      weightBatches,
      "EQUAL",
      new Prisma.Decimal(80),
      new Prisma.Decimal(20),
    );
    expect(amounts(shares, "p01")).toEqual({ transport: "40", customs: "10" });
    expect(amounts(shares, "p02")).toEqual({ transport: "40", customs: "10" });
  });

  it("allocates a mixed receipt by acquisition value", () => {
    const mixed = [
      batch("p01", "P01", "PIECE", "240", "6000"),
      batch("p02", "P02", "WEIGHT", "1214", "4000"),
    ];
    expect(isMixedReceipt(mixed)).toBe(true);
    expect(allocationBasis(mixed)).toBe("ACQUISITION");
    expect(proportionalEligibility(mixed)).toEqual({
      basis: "ACQUISITION",
      available: true,
      blockedReason: null,
    });
    const shares = allocateExpenses(
      mixed,
      "BY_VALUE",
      new Prisma.Decimal(2000),
      new Prisma.Decimal(350),
    );
    expect(amounts(shares, "p01")).toEqual({
      transport: "1200",
      customs: "210",
    });
    expect(amounts(shares, "p02")).toEqual({
      transport: "800",
      customs: "140",
    });
  });

  it("keeps zero acquisition values as valid zero shares", () => {
    const mixed = [
      batch("p01", "P01", "PIECE", "10", "0"),
      batch("p02", "P02", "WEIGHT", "10", "100"),
    ];
    expect(proportionalEligibility(mixed).available).toBe(true);
    const shares = allocateExpenses(
      mixed,
      "BY_VALUE",
      new Prisma.Decimal(100),
      new Prisma.Decimal(0),
    );
    expect(amounts(shares, "p01")).toEqual({ transport: "0", customs: "0" });
    expect(amounts(shares, "p02")).toEqual({ transport: "100", customs: "0" });
  });

  it("blocks proportional allocation when a mixed acquisition value is missing", () => {
    const mixed = [
      batch("p01", "P01", "PIECE", "10", "100"),
      batch("p02", "P02", "WEIGHT", "10", null),
    ];
    expect(proportionalEligibility(mixed)).toMatchObject({
      basis: "ACQUISITION",
      available: false,
    });
    expect(proportionalEligibility(mixed).blockedReason).toContain("P02");
    expect(() =>
      allocateExpenses(
        mixed,
        "BY_VALUE",
        new Prisma.Decimal(10),
        new Prisma.Decimal(5),
      ),
    ).toThrow(MissingAcquisitionValueError);
    const equal = allocateExpenses(
      mixed,
      "EQUAL",
      new Prisma.Decimal(10),
      new Prisma.Decimal(5),
    );
    expect(amounts(equal, "p01")).toEqual({ transport: "5", customs: "2.5" });
  });

  it("blocks proportional allocation when all mixed acquisition values are zero", () => {
    const mixed = [
      batch("p01", "P01", "PIECE", "10", "0"),
      batch("p02", "P02", "WEIGHT", "10", "0"),
    ];
    expect(proportionalEligibility(mixed).available).toBe(false);
    expect(proportionalEligibility(mixed).blockedReason).toContain("0");
    expect(() =>
      allocateExpenses(
        mixed,
        "BY_VALUE",
        new Prisma.Decimal(10),
        new Prisma.Decimal(5),
      ),
    ).toThrow(ZeroAcquisitionBasisError);
  });

  it("uses largest-remainder rounding and excludes zero-quantity batches", () => {
    const batches = [
      batch("a", "P01", "WEIGHT", "1"),
      batch("b", "P02", "WEIGHT", "1"),
      batch("c", "P03", "WEIGHT", "1"),
      batch("zero", "P04", "WEIGHT", "0"),
    ];
    const shares = allocateExpenses(
      batches,
      "BY_VALUE",
      new Prisma.Decimal("0.01"),
      new Prisma.Decimal("0.02"),
    );
    const values = ["a", "b", "c"].map((id) => amounts(shares, id));
    expect(values.reduce((sum, value) => sum + Number(value.transport), 0)).toBe(
      0.01,
    );
    expect(values.reduce((sum, value) => sum + Number(value.customs), 0)).toBe(
      0.02,
    );
    expect(shares.has("zero")).toBe(false);
  });
});
