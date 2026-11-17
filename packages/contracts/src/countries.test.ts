import { describe, expect, it } from "vitest";
import {
  canonicalCountryCode,
  CountryCodeSchema,
  COUNTRY_OPTIONS,
  countryName,
  isCountryCode,
} from "./countries";

describe("country dataset", () => {
  it("contains the complete ISO 3166-1 alpha-2 list with Lithuanian names", () => {
    expect(COUNTRY_OPTIONS.length).toBeGreaterThanOrEqual(249);
    expect(COUNTRY_OPTIONS).toContainEqual({ code: "LT", name: "Lietuva" });
    expect(COUNTRY_OPTIONS).toContainEqual({
      code: "GB",
      name: "Jungtinė Karalystė",
    });
    expect(COUNTRY_OPTIONS).toContainEqual({
      code: "US",
      name: "Jungtinės Valstijos",
    });
  });

  it("stores unique uppercase alpha-2 codes", () => {
    const codes = COUNTRY_OPTIONS.map((country) => country.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z]{2}$/);
    }
  });

  it("resolves Lithuanian display names from codes", () => {
    expect(countryName("LT")).toBe("Lietuva");
    expect(countryName("gb")).toBe("Jungtinė Karalystė");
    expect(countryName(null)).toBeUndefined();
    expect(countryName("XX")).toBeUndefined();
  });

  it("accepts only known codes through the shared schema", () => {
    expect(CountryCodeSchema.parse(" lt ")).toBe("LT");
    expect(CountryCodeSchema.safeParse("Lietuva").success).toBe(false);
    expect(CountryCodeSchema.safeParse("XX").success).toBe(false);
    expect(isCountryCode("GB")).toBe(true);
    expect(isCountryCode("gb")).toBe(false);
  });

  it("canonicalises recognizable legacy country names", () => {
    expect(canonicalCountryCode("Jungtinė Karalystė")).toBe("GB");
    expect(canonicalCountryCode("United Kingdom")).toBe("GB");
    expect(canonicalCountryCode("Lietuva")).toBe("LT");
    expect(canonicalCountryCode("gb")).toBe("GB");
    expect(canonicalCountryCode("Narnija")).toBeNull();
    expect(canonicalCountryCode("")).toBeNull();
  });
});
