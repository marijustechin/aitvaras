import { describe, expect, it } from "vitest";
import { ApiError } from "@/shared/api";
import { loginErrorMessage, shouldShowDevLoginHint } from "./login-ui";

describe("loginErrorMessage", () => {
  it("maps authentication failures to a generic credentials message", () => {
    expect(loginErrorMessage(new ApiError(401, "Invalid credentials"))).toBe(
      "Neteisingas naudotojo vardas arba slaptažodis.",
    );
  });

  it("maps other errors to a separate server message", () => {
    expect(loginErrorMessage(new Error("network down"))).toBe(
      "Nepavyko prisijungti prie serverio. Bandykite dar kartą.",
    );
    expect(loginErrorMessage(new ApiError(500, "boom"))).toBe(
      "Nepavyko prisijungti prie serverio. Bandykite dar kartą.",
    );
  });
});

describe("shouldShowDevLoginHint", () => {
  it("is visible only in development", () => {
    expect(shouldShowDevLoginHint("development")).toBe(true);
    expect(shouldShowDevLoginHint("production")).toBe(false);
    expect(shouldShowDevLoginHint("test")).toBe(false);
    expect(shouldShowDevLoginHint(undefined)).toBe(false);
  });
});
