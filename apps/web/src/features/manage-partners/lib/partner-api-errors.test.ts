import { describe, expect, it } from "vitest";
import { ApiError } from "@/shared/api";
import { partnerFieldErrorsFromApi } from "./partner-api-errors";

describe("partnerFieldErrorsFromApi", () => {
  it("maps duplicate identification to the company code field", () => {
    const message = "Šioje šalyje jau yra partneris su tokiu įmonės kodu.";
    const error = new ApiError(409, message, "PARTNER_DUPLICATE_IDENTIFICATION", [
      { path: "companyCode", message },
    ]);
    expect(partnerFieldErrorsFromApi(error)).toEqual({
      companyCode: message,
    });
  });

  it("ignores unknown paths and non-Api errors", () => {
    const error = new ApiError(400, "Validation failed", "VALIDATION_ERROR", [
      { path: "notes", message: "ignored" },
      { path: "name", message: "Įveskite partnerio pavadinimą." },
    ]);
    expect(partnerFieldErrorsFromApi(error)).toEqual({
      name: "Įveskite partnerio pavadinimą.",
    });
    expect(partnerFieldErrorsFromApi(new Error("boom"))).toBeNull();
    expect(partnerFieldErrorsFromApi(new ApiError(500, "boom"))).toBeNull();
  });
});
