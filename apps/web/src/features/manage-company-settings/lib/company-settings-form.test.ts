import { describe, expect, it } from "vitest";
import {
  companySettingsFieldErrors,
  companySettingsPayload,
  companySettingsToForm,
  emptyCompanySettingsForm,
} from "./company-settings-form";

describe("company settings form", () => {
  it("starts empty instead of inventing defaults", () => {
    expect(emptyCompanySettingsForm()).toEqual({
      name: "",
      companyCode: "",
      vatCode: "",
      country: "",
      address: "",
      email: "",
      phone: "",
    });
  });

  it("maps a saved record into the form", () => {
    const form = companySettingsToForm({
      name: "UAB Aitvaras",
      companyCode: "001234",
      vatCode: null,
      country: "LT",
      address: null,
      email: null,
      phone: null,
      updatedAt: "2026-11-17T10:00:00.000Z",
    });
    expect(form).toMatchObject({
      name: "UAB Aitvaras",
      companyCode: "001234",
      vatCode: "",
      country: "LT",
    });
  });

  it("requires name, registration number and country only", () => {
    const errors = companySettingsFieldErrors(emptyCompanySettingsForm());
    expect(Object.keys(errors).sort()).toEqual([
      "companyCode",
      "country",
      "name",
    ]);
    expect(
      companySettingsFieldErrors({
        ...emptyCompanySettingsForm(),
        name: "UAB Aitvaras",
        companyCode: "001234",
        country: "LT",
      }),
    ).toEqual({});
  });

  it("trims values for the request payload", () => {
    expect(
      companySettingsPayload({
        name: "  UAB Aitvaras ",
        companyCode: " 001234 ",
        vatCode: "",
        country: "LT",
        address: "  Vilnius ",
        email: "",
        phone: " +370 600 00000 ",
      }),
    ).toEqual({
      name: "UAB Aitvaras",
      companyCode: "001234",
      vatCode: "",
      country: "LT",
      address: "Vilnius",
      email: "",
      phone: "+370 600 00000",
    });
  });
});
