import { describe, expect, it } from "vitest";
import {
  CreatePartnerRequestSchema,
  PARTNER_ROLE_KEYS,
  PARTNER_ROLE_LABELS,
  UpdatePartnerRequestSchema,
  sortPartnerRoles,
} from "./partners";

const identification = {
  country: "LT",
  companyCode: "001234",
} as const;

describe("partner role labels", () => {
  it("provides a non-empty Lithuanian label for every partner role", () => {
    for (const key of PARTNER_ROLE_KEYS) {
      expect(typeof PARTNER_ROLE_LABELS[key]).toBe("string");
      expect(PARTNER_ROLE_LABELS[key].length).toBeGreaterThan(0);
    }
  });

  it("does not expose the raw partner role key as its label", () => {
    for (const key of PARTNER_ROLE_KEYS) {
      expect(PARTNER_ROLE_LABELS[key]).not.toBe(key);
    }
  });
});

describe("sortPartnerRoles", () => {
  it("orders roles deterministically and removes duplicates", () => {
    expect(sortPartnerRoles(["BUYER", "SUPPLIER", "BUYER"])).toEqual([
      "SUPPLIER",
      "BUYER",
    ]);
    expect(sortPartnerRoles(["SUPPLIER"])).toEqual(["SUPPLIER"]);
    expect(sortPartnerRoles(["BUYER"])).toEqual(["BUYER"]);
  });
});

describe("CreatePartnerRequestSchema", () => {
  it("requires a name, at least one role and company identification", () => {
    expect(
      CreatePartnerRequestSchema.safeParse({
        name: "  ",
        roles: ["SUPPLIER"],
        ...identification,
      }).success,
    ).toBe(false);
    expect(
      CreatePartnerRequestSchema.safeParse({
        name: "UAB Mediena",
        roles: [],
        ...identification,
      }).success,
    ).toBe(false);
    expect(
      CreatePartnerRequestSchema.safeParse({
        name: "UAB Mediena",
        roles: ["SUPPLIER"],
      }).success,
    ).toBe(false);
    expect(
      CreatePartnerRequestSchema.safeParse({
        name: "UAB Mediena",
        roles: ["SUPPLIER"],
        companyCode: "001234",
      }).success,
    ).toBe(false);
    expect(
      CreatePartnerRequestSchema.safeParse({
        name: "UAB Mediena",
        roles: ["SUPPLIER"],
        country: "LT",
      }).success,
    ).toBe(false);
  });

  it("accepts supplier, buyer and combined roles", () => {
    for (const roles of [["SUPPLIER"], ["BUYER"], ["SUPPLIER", "BUYER"]]) {
      expect(
        CreatePartnerRequestSchema.safeParse({
          name: "UAB Mediena",
          roles,
          ...identification,
        }).success,
      ).toBe(true);
    }
  });

  it("trims text, preserves leading zeros and normalises the country code", () => {
    const parsed = CreatePartnerRequestSchema.parse({
      name: "  UAB Mediena  ",
      roles: ["SUPPLIER"],
      country: "  lt ",
      companyCode: " 001234 ",
      notes: "  pastaba  ",
    });
    expect(parsed.name).toBe("UAB Mediena");
    expect(parsed.country).toBe("LT");
    expect(parsed.companyCode).toBe("001234");
    expect(parsed.notes).toBe("pastaba");
  });

  it("rejects a country that is not a known ISO alpha-2 code", () => {
    for (const country of ["Lietuva", "XX", "", "  "]) {
      expect(
        CreatePartnerRequestSchema.safeParse({
          name: "UAB Mediena",
          roles: ["SUPPLIER"],
          companyCode: "001234",
          country,
        }).success,
      ).toBe(false);
    }
  });

  it("rejects an empty registration number", () => {
    expect(
      CreatePartnerRequestSchema.safeParse({
        name: "UAB Mediena",
        roles: ["SUPPLIER"],
        country: "LT",
        companyCode: "   ",
      }).success,
    ).toBe(false);
  });

  it("rejects unknown fields (no silent privilege pass-through)", () => {
    expect(
      CreatePartnerRequestSchema.safeParse({
        name: "UAB Mediena",
        roles: ["SUPPLIER"],
        ...identification,
        id: "0f1f2f3f-0000-0000-0000-000000000000",
      }).success,
    ).toBe(false);
    expect(
      CreatePartnerRequestSchema.safeParse({
        name: "UAB Mediena",
        roles: ["SUPPLIER"],
        ...identification,
        createdAt: "2026-01-01T00:00:00.000Z",
      }).success,
    ).toBe(false);
  });
});

describe("UpdatePartnerRequestSchema", () => {
  it("rejects an empty update and unknown fields", () => {
    expect(UpdatePartnerRequestSchema.safeParse({}).success).toBe(false);
    expect(
      UpdatePartnerRequestSchema.safeParse({ unknown: true }).success,
    ).toBe(false);
  });

  it("allows clearing an optional field and never accepts zero roles", () => {
    const cleared = UpdatePartnerRequestSchema.parse({ notes: "" });
    expect(cleared.notes).toBeNull();

    expect(UpdatePartnerRequestSchema.safeParse({ roles: [] }).success).toBe(
      false,
    );
  });

  it("validates identification fields when they are supplied", () => {
    expect(UpdatePartnerRequestSchema.safeParse({ country: "" }).success).toBe(
      false,
    );
    expect(
      UpdatePartnerRequestSchema.safeParse({ companyCode: "   " }).success,
    ).toBe(false);
    expect(
      UpdatePartnerRequestSchema.parse({
        country: "gb",
        companyCode: " 0042 ",
      }),
    ).toMatchObject({ country: "GB", companyCode: "0042" });
  });
});
