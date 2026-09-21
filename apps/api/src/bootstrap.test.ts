import { describe, expect, it } from "vitest";
import { CORS_METHODS, buildCorsOptions, resolveWebOrigins } from "./bootstrap";

describe("resolveWebOrigins", () => {
  it("splits, trims and drops empty entries", () => {
    expect(
      resolveWebOrigins("http://localhost:3011, http://127.0.0.1:3011,"),
    ).toEqual(["http://localhost:3011", "http://127.0.0.1:3011"]);
  });

  it("refuses a wildcard because credentials are enabled", () => {
    expect(() => resolveWebOrigins("*")).toThrow(/explicit origins/);
    expect(() => resolveWebOrigins("")).toThrow(/explicit origins/);
  });
});

describe("buildCorsOptions", () => {
  it("allows the methods the browser needs for updates", () => {
    const options = buildCorsOptions();
    expect(options.credentials).toBe(true);
    expect(options.methods).toEqual([...CORS_METHODS]);
    // Regression: Fastify's CORS default omits PATCH/PUT/DELETE, which blocked
    // user/partner/resource updates from the browser.
    expect(options.methods).toContain("PATCH");
    expect(options.methods).toContain("PUT");
    expect(options.methods).toContain("DELETE");
  });
});
