import { describe, expect, it } from "vitest";
import { HealthResponseSchema } from "./health";

describe("HealthResponseSchema", () => {
  it("accepts a valid health response", () => {
    const parsed = HealthResponseSchema.parse({
      status: "ok",
      service: "aitvaras-api",
    });

    expect(parsed).toEqual({ status: "ok", service: "aitvaras-api" });
  });

  it("rejects a response from a different service", () => {
    expect(() =>
      HealthResponseSchema.parse({ status: "ok", service: "sandelys" }),
    ).toThrow();
  });
});
