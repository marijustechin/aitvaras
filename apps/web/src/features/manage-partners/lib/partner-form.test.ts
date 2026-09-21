import { describe, expect, it } from "vitest";
import type { Partner } from "@aitvaras/contracts";
import {
  emptyPartnerFormValues,
  partnerFormError,
  partnerFormToPayload,
  partnerToFormValues,
} from "./partner-form";

const partner: Partner = {
  id: "0f1f2f3f-0000-4000-8000-000000000000",
  name: "UAB Mediena",
  companyCode: "123456789",
  vatCode: null,
  address: null,
  country: "Lietuva",
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
    expect(values.vatCode).toBe("");
    expect(values.roles).toEqual(["SUPPLIER"]);
    expect(values.active).toBe(true);
  });

  it("trims payload text", () => {
    const payload = partnerFormToPayload({
      ...partnerToFormValues(partner),
      name: "  UAB Mediena  ",
      country: "  Lietuva ",
    });
    expect(payload.name).toBe("UAB Mediena");
    expect(payload.country).toBe("Lietuva");
  });

  it("requires a name and at least one role", () => {
    const values = partnerToFormValues(partner);
    expect(partnerFormError(values)).toBeNull();
    expect(partnerFormError({ ...values, name: "   " })).toBe(
      "Įveskite partnerio pavadinimą.",
    );
    expect(partnerFormError({ ...values, roles: [] })).toBe(
      "Pasirinkite bent vieną vaidmenį.",
    );
  });
});
