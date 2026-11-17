import { describe, expect, it } from "vitest";
import { invalidFieldsSummary } from "./form-feedback";

describe("invalidFieldsSummary", () => {
  it("returns null when nothing is invalid", () => {
    expect(invalidFieldsSummary({}, {})).toBeNull();
  });

  it("keeps the single field message", () => {
    expect(
      invalidFieldsSummary({ name: "Įveskite pavadinimą." }, { name: "Pavadinimas" }),
    ).toBe("Įveskite pavadinimą.");
  });

  it("summarises several affected fields once", () => {
    expect(
      invalidFieldsSummary(
        {
          name: "Įveskite įmonės pavadinimą.",
          country: "Pasirinkite šalį.",
        },
        { name: "Pavadinimas", country: "Šalis" },
      ),
    ).toBe("Patikrinkite laukus: Pavadinimas, Šalis.");
  });
});
