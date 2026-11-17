import { describe, expect, it } from "vitest";
import {
  CompanySettingsSchema,
  UpdateCompanySettingsRequestSchema,
} from "./company-settings";

const validRequest = {
  name: "  UAB Aitvaras  ",
  companyCode: " 001234 ",
  vatCode: "",
  country: "lt",
  address: "",
  email: "",
  phone: " +370 600 00000 ",
};

describe("UpdateCompanySettingsRequestSchema", () => {
  it("trims identification fields and normalises the country", () => {
    const parsed = UpdateCompanySettingsRequestSchema.parse(validRequest);
    expect(parsed).toMatchObject({
      name: "UAB Aitvaras",
      companyCode: "001234",
      vatCode: null,
      country: "LT",
      address: null,
      email: null,
      phone: "+370 600 00000",
    });
  });

  it("requires a name, registration number and known country", () => {
    expect(
      UpdateCompanySettingsRequestSchema.safeParse({
        ...validRequest,
        name: "   ",
      }).success,
    ).toBe(false);
    expect(
      UpdateCompanySettingsRequestSchema.safeParse({
        ...validRequest,
        companyCode: "",
      }).success,
    ).toBe(false);
    expect(
      UpdateCompanySettingsRequestSchema.safeParse({
        ...validRequest,
        country: "ZZ",
      }).success,
    ).toBe(false);
  });

  it("keeps the VAT number optional", () => {
    const withoutVat = { ...validRequest };
    delete (withoutVat as { vatCode?: string }).vatCode;
    expect(UpdateCompanySettingsRequestSchema.safeParse(withoutVat).success).toBe(
      true,
    );
  });

  it("rejects unknown keys", () => {
    expect(
      UpdateCompanySettingsRequestSchema.safeParse({
        ...validRequest,
        id: "not-allowed",
      }).success,
    ).toBe(false);
  });
});

describe("CompanySettingsSchema", () => {
  it("represents the never-saved empty record", () => {
    expect(
      CompanySettingsSchema.parse({
        name: "",
        companyCode: null,
        vatCode: null,
        country: null,
        address: null,
        email: null,
        phone: null,
        updatedAt: null,
      }).updatedAt,
    ).toBeNull();
  });
});
