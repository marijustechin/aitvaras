import { describe, expect, it } from "vitest";
import type { Partner } from "@aitvaras/contracts";
import {
  emptyPartnerFormValues,
  partnerFormFieldErrors,
  partnerFormToPayload,
  partnerToFormValues,
} from "./partner-form";

const partner: Partner = {
  id: "0f1f2f3f-0000-4000-8000-000000000000",
  name: "UAB Mediena",
  companyCode: "001234",
  vatCode: null,
  address: null,
  country: "LT",
  contactPerson: null,
  phone: null,
  email: null,
  notes: null,
  roles: ["SUPPLIER"],
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("partner form values", () => {
  it("defaults a new partner to active with no roles", () => {
    const values = emptyPartnerFormValues();
    expect(values).toEqual({
      name: "",
      roles: [],
      companyCode: "",
      vatCode: "",
      country: "",
      address: "",
      contactPerson: "",
      phone: "",
      email: "",
      notes: "",
      active: true,
    });
  });

  it("maps a partner to form values, turning nulls into empty strings", () => {
    const values = partnerToFormValues(partner);
    expect(values.name).toBe("UAB Mediena");
    expect(values.companyCode).toBe("001234");
    expect(values.country).toBe("LT");
    expect(values.vatCode).toBe("");
    expect(values.roles).toEqual(["SUPPLIER"]);
    expect(values.active).toBe(true);
  });

  it("canonicalises a recognizable legacy country name", () => {
    const values = partnerToFormValues({ ...partner, country: "Lietuva" });
    expect(values.country).toBe("LT");
    expect(
      partnerToFormValues({ ...partner, country: "Narnija" }).country,
    ).toBe("");
  });

  it("trims payload text, preserves leading zeros and uppercases the country", () => {
    const payload = partnerFormToPayload({
      ...partnerToFormValues(partner),
      name: "  UAB Mediena  ",
      country: " lt ",
      companyCode: " 000123 ",
    });
    expect(payload.name).toBe("UAB Mediena");
    expect(payload.country).toBe("LT");
    expect(payload.companyCode).toBe("000123");
  });
});

describe("partner form validation", () => {
  it("requires name, roles, country and company registration number", () => {
    const values = partnerToFormValues(partner);
    expect(partnerFormFieldErrors(values)).toEqual({});

    expect(
      partnerFormFieldErrors({ ...values, name: "   " }).name,
    ).toBe("Įveskite partnerio pavadinimą.");
    expect(partnerFormFieldErrors({ ...values, roles: [] }).roles).toBe(
      "Pasirinkite bent vieną vaidmenį.",
    );
    expect(partnerFormFieldErrors({ ...values, country: "" }).country).toBe(
      "Pasirinkite šalį.",
    );
    expect(partnerFormFieldErrors({ ...values, country: "Lietuva" }).country).toBe(
      "Pasirinkite šalį iš sąrašo.",
    );
    expect(
      partnerFormFieldErrors({ ...values, companyCode: "  " }).companyCode,
    ).toBe("Įveskite įmonės kodą.");
  });

  it("returns all identification errors together", () => {
    const errors = partnerFormFieldErrors({
      ...emptyPartnerFormValues(),
      name: "",
      roles: [],
      country: "",
      companyCode: "",
    });
    expect(Object.keys(errors).sort()).toEqual([
      "companyCode",
      "country",
      "name",
      "roles",
    ]);
  });
});
