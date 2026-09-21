import { describe, expect, it } from "vitest";
import {
  CreatePartnerRequestSchema,
  PARTNER_ROLE_KEYS,
  PARTNER_ROLE_LABELS,
  UpdatePartnerRequestSchema,
  sortPartnerRoles,
} from "./partners";

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
  it("requires a name and at least one role", () => {
    expect(
      CreatePartnerRequestSchema.safeParse({ name: "  ", roles: ["SUPPLIER"] })
        .success,
    ).toBe(false);
    expect(
      CreatePartnerRequestSchema.safeParse({ name: "UAB Mediena", roles: [] })
        .success,
    ).toBe(false);
  });

  it("accepts supplier, buyer and combined roles", () => {
    for (const roles of [["SUPPLIER"], ["BUYER"], ["SUPPLIER", "BUYER"]]) {
      expect(
        CreatePartnerRequestSchema.safeParse({ name: "UAB Mediena", roles })
          .success,
      ).toBe(true);
    }
  });

  it("trims text and normalises empty optional values to null", () => {
    const parsed = CreatePartnerRequestSchema.parse({
      name: "  UAB Mediena  ",
      roles: ["SUPPLIER"],
      country: "  ",
      notes: "  pastaba  ",
    });
    expect(parsed.name).toBe("UAB Mediena");
    expect(parsed.country).toBeNull();
    expect(parsed.notes).toBe("pastaba");
  });

  it("rejects unknown fields (no silent privilege pass-through)", () => {
    expect(
      CreatePartnerRequestSchema.safeParse({
        name: "UAB Mediena",
        roles: ["SUPPLIER"],
        id: "0f1f2f3f-0000-0000-0000-000000000000",
      }).success,
    ).toBe(false);
    expect(
      CreatePartnerRequestSchema.safeParse({
        name: "UAB Mediena",
        roles: ["SUPPLIER"],
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
});
