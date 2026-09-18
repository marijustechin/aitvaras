import { describe, expect, it } from "vitest";
import { HealthResponseSchema } from "@aitvaras/contracts";
import { HealthController } from "./health.controller";

describe("HealthController", () => {
  it("returns a response matching the shared health contract", () => {
    const controller = new HealthController();

    expect(HealthResponseSchema.parse(controller.getHealth())).toEqual({
      status: "ok",
      service: "aitvaras-api",
    });
  });
});
