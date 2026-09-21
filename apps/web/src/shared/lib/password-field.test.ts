import { describe, expect, it } from "vitest";
import { passwordFieldState } from "./password-field";

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
