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

  it("is hidden by default (password type, toggles back after hiding)", () => {
    // The reset form starts hidden and toggles back to hidden on second press.
    expect(passwordFieldState(false).inputType).toBe("password");
    expect(passwordFieldState(true).inputType).toBe("text");
    expect(passwordFieldState(false).inputType).toBe("password");
  });

  it("lets two fields toggle independently", () => {
    let first = false;
    let second = false;

    first = !first;
    expect(passwordFieldState(first).inputType).toBe("text");
    expect(passwordFieldState(second).inputType).toBe("password");

    second = !second;
    expect(passwordFieldState(first).inputType).toBe("text");
    expect(passwordFieldState(second).inputType).toBe("text");

    first = !first;
    expect(passwordFieldState(first).inputType).toBe("password");
    expect(passwordFieldState(second).inputType).toBe("text");
  });
});
