import { describe, expect, it } from "vitest";
import { ApiError } from "./api";
import {
  loginErrorMessage,
  passwordFieldState,
  shouldShowDevLoginHint,
} from "./login-ui";

describe("passwordFieldState", () => {
  it("shows a crossed-out eye and password type while hidden", () => {
    expect(passwordFieldState(false)).toEqual({
      inputType: "password",
      icon: "eye-off",
      ariaLabel: "Rodyti slaptažodį",
    });
  });

  it("shows an open eye and text type while visible", () => {
    expect(passwordFieldState(true)).toEqual({
      inputType: "text",
      icon: "eye",
      ariaLabel: "Slėpti slaptažodį",
    });
  });
});

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
